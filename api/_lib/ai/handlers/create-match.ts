import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../../../types/vercel';
import { supabaseAdmin } from '../../supabase-admin';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../../http';
import { limitAiByUser, limitByIp } from '../../rate-limit-utils';
import { actorOwnsAnyPublication, getActor, isModerator } from '../../authz';

/**
 * POST /api/ai?action=create-match — crea una coincidencia entre dos publicaciones.
 *
 * Hallazgo API-03: el endpoint aceptaba `overallScore`, `structuredScore`,
 * `textScore`, `semanticScore` y `visualScore` **enviados por el cliente** y los
 * insertaba tal cual, y solo comprobaba que las dos publicaciones existieran. Con
 * eso, cualquier usuario autenticado podía:
 *
 *   - inventarse un match del 100 % entre publicaciones ajenas,
 *   - y disparar notificaciones falsas a sus dueños ("¡encontramos tu mascota!").
 *
 * Ahora:
 *
 *   - El servidor **recalcula** el score con
 *     `calculate_structured_match_score` (la misma función que usa
 *     `calculate-matches`). Lo que envíe el cliente se ignora por completo.
 *   - Se exige ser **dueño de A o B** (o moderador).
 *   - Se conservan las protecciones que ya había: nada de matches de una
 *     publicación consigo misma y nada de duplicados (409).
 */

const createMatchSchema = z.object({
  publicationAId: z.string().uuid('El identificador de la primera publicación no es válido'),
  publicationBId: z.string().uuid('El identificador de la segunda publicación no es válido'),
  // Se acepta por compatibilidad con el cliente actual, pero NO se usa.
  overallScore: z.number().min(0).max(100).optional(),
});

/** Score mínimo para considerar que dos publicaciones son una coincidencia. */
const MIN_MATCH_SCORE = 60;

/** Por debajo de esto la coincidencia es demasiado débil para notificar. */
const NOTIFY_THRESHOLD = 75;

export async function handleCreateMatch(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'ai-match-ip', 120, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const userLimit = await limitAiByUser(res, auth.user.id);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, createMatchSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const { publicationAId, publicationBId } = parsed.data;

  if (publicationAId === publicationBId) {
    return fail(res, 400, 'INVALID_INPUT', 'No se puede emparejar una publicación consigo misma');
  }

  // Orden canónico para que el índice único (least, greatest) evite duplicados.
  const [pubAId, pubBId] =
    publicationAId < publicationBId
      ? [publicationAId, publicationBId]
      : [publicationBId, publicationAId];

  const { data: publications, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, owner_profile_id, type')
    .in('id', [pubAId, pubBId])
    .is('deleted_at', null);

  if (pubError) {
    return internalError(res, 'create-match/publications', pubError);
  }

  if (!publications || publications.length !== 2) {
    return fail(res, 404, 'NOT_FOUND', 'Una de las publicaciones no existe');
  }

  const actor = await getActor(supabaseAdmin, auth.user.id);

  if (!actor) {
    return fail(res, 403, 'FORBIDDEN', 'Tu perfil no está disponible todavía');
  }

  // Autorización: dueño de A o B, o moderador.
  const allowed = await actorOwnsAnyPublication(supabaseAdmin, actor, [pubAId, pubBId]);

  if (!allowed) {
    return fail(
      res,
      403,
      'FORBIDDEN',
      'Solo el dueño de una de las publicaciones puede crear la coincidencia'
    );
  }

  // ── Recálculo en servidor ────────────────────────────────────────────────
  // El score estructurado lo calcula la base de datos a partir de las columnas
  // reales de ambas publicaciones. Los valores del cliente se descartan.
  const { data: scoreData, error: scoreError } = await supabaseAdmin.rpc(
    'calculate_structured_match_score',
    { pub_a_id: pubAId, pub_b_id: pubBId }
  );

  if (scoreError) {
    return internalError(res, 'create-match/score', scoreError);
  }

  const structuredScore = Number(scoreData ?? 0);

  if (!Number.isFinite(structuredScore) || structuredScore < MIN_MATCH_SCORE) {
    return fail(
      res,
      422,
      'INVALID_INPUT',
      `Las publicaciones no son lo bastante similares (${Math.round(structuredScore || 0)} % de coincidencia)`,
      { structuredScore: Number.isFinite(structuredScore) ? structuredScore : 0 }
    );
  }

  const typeA = publications.find((p: { id: string; type: string }) => p.id === pubAId)?.type;
  const typeB = publications.find((p: { id: string; type: string }) => p.id === pubBId)?.type;

  const matchType =
    (typeA === 'LOST' && typeB === 'FOUND') || (typeA === 'FOUND' && typeB === 'LOST')
      ? 'LOST_FOUND'
      : 'SEMANTIC';

  const { data: match, error: matchError } = await supabaseAdmin
    .from('ai_matches')
    .insert({
      publication_a_id: pubAId,
      publication_b_id: pubBId,
      match_type: matchType,
      // Todos los scores son calculados aquí, nunca recibidos.
      overall_score: structuredScore,
      structured_score: structuredScore,
      text_score: null,
      semantic_score: null,
      visual_score: null,
      status: 'PENDING',
      viewed_by_a: false,
      viewed_by_b: false,
      reasons: ['Coincidencia calculada por el servidor'],
      metadata: { source: 'api', created_by: actor.id, client_scores_ignored: true },
    })
    .select('id')
    .single();

  if (matchError) {
    if (matchError.code === '23505') {
      return fail(res, 409, 'CONFLICT', 'Esa coincidencia ya existe');
    }
    return internalError(res, 'create-match/insert', matchError);
  }

  // Notificación a los dueños, solo si la coincidencia es fuerte y son distintos.
  const ownerAId = publications.find((p: { id: string; owner_profile_id: string | null }) => p.id === pubAId)?.owner_profile_id ?? null;
  const ownerBId = publications.find((p: { id: string; owner_profile_id: string | null }) => p.id === pubBId)?.owner_profile_id ?? null;

  let notified = false;

  if (
    structuredScore >= NOTIFY_THRESHOLD &&
    ownerAId &&
    ownerBId &&
    ownerAId !== ownerBId
  ) {
    const body = `Encontramos una posible coincidencia para tu publicación (${Math.round(structuredScore)} % de similitud).`;

    const { error: notifyError } = await supabaseAdmin.from('notifications').insert([
      {
        profile_id: ownerAId,
        type: 'MATCH',
        title: '¡Posible coincidencia!',
        body,
        link: `/p/${pubAId}`,
        is_read: false,
      },
      {
        profile_id: ownerBId,
        type: 'MATCH',
        title: '¡Posible coincidencia!',
        body,
        link: `/p/${pubBId}`,
        is_read: false,
      },
    ]);

    if (!notifyError) {
      notified = true;

      await supabaseAdmin
        .from('ai_matches')
        .update({ status: 'NOTIFIED', notified_at: new Date().toISOString() })
        .eq('id', match.id);
    } else {
      console.error('[create-match] no se pudieron crear las notificaciones', notifyError);
    }
  }

  return json(res, 200, {
    ok: true,
    matchId: match.id,
    structuredScore,
    matchType,
    notified,
    moderated: isModerator(actor),
  });
}