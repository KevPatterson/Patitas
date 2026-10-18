import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../_lib/http';
import { limitAiByUser, limitByIp } from '../_lib/rate-limit-utils';
import { canManagePublication, getActor, loadPublication } from '../_lib/authz';

/**
 * POST /api/ai/calculate-matches — candidatos de coincidencia para una publicación.
 *
 * Hallazgo API-02 (IDOR de lectura): el endpoint **no comprobaba la propiedad**.
 * Cualquier usuario autenticado podía pasar el UUID de una publicación ajena y
 * recibir sus metadatos y los de sus candidatas (provincia, municipio, color,
 * tamaño). Ahora se exige ser dueño de la publicación o moderador.
 *
 * Además el body se valida con Zod y se aplica cuota por usuario.
 */

const calculateSchema = z.object({
  publicationId: z.string().uuid('El identificador de la publicación no es válido'),
  minScore: z.number().min(0).max(100).optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'ai-calculate-ip', 60, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const userLimit = await limitAiByUser(res, auth.user.id);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, calculateSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const minScore = parsed.data.minScore ?? 60;
  const limit = parsed.data.limit ?? 10;

  // Autorización ANTES de leer nada de la publicación.
  const ownership = await loadPublication(supabaseAdmin, parsed.data.publicationId);

  if (!ownership) {
    return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
  }

  const actor = await getActor(supabaseAdmin, auth.user.id);

  if (!canManagePublication(actor, ownership)) {
    return fail(
      res,
      403,
      'FORBIDDEN',
      'Solo el dueño de la publicación puede calcular sus coincidencias'
    );
  }

  const { data: publication, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, type, species, breed, sex, size, color, event_date, location:locations(province, municipality)')
    .eq('id', parsed.data.publicationId)
    .is('deleted_at', null)
    .single();

  if (pubError || !publication) {
    return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
  }

  // Buscar candidatos complementarios
  let complementaryType: string | null = null;
  if (publication.type === 'LOST') complementaryType = 'FOUND';
  else if (publication.type === 'FOUND') complementaryType = 'LOST';

  if (!complementaryType) {
    return res.status(400).json({ error: 'Publication type does not support matching' });
  }

  // Buscar publicaciones candidatas (misma especie, tipo complementario, misma provincia)
  const { data: candidates, error: candidatesError } = await supabaseAdmin
    .from('publications')
    .select('id, type, species, breed, sex, size, color, event_date, location:locations(province, municipality)')
    .eq('type', complementaryType)
    .eq('species', publication.species)
    .in('status', ['ACTIVE'])
    .is('deleted_at', null)
    .neq('id', parsed.data.publicationId)
    .limit(100);

  if (candidatesError) {
    return internalError(res, 'calculate-matches/candidates', candidatesError);
  }

  if (!candidates || candidates.length === 0) {
    return res.status(200).json({ ok: true, matches: [] });
  }

  // Calcular score estructurado para cada candidato
  const matches: Array<{
    publicationId: string;
    score: number;
    reasons: string[];
  }> = [];

  for (const candidate of candidates) {
    try {
      const { data: score } = await supabaseAdmin.rpc('calculate_structured_match_score', {
        pub_a_id: parsed.data.publicationId,
        pub_b_id: candidate.id,
      });

      if (score && score >= minScore) {
        const reasons: string[] = ['Misma especie'];

        if (publication.location && candidate.location) {
          const pubLoc = Array.isArray(publication.location) ? publication.location[0] : publication.location;
          const candLoc = Array.isArray(candidate.location) ? candidate.location[0] : candidate.location;

          if (pubLoc?.province === candLoc?.province) {
            reasons.push('Misma provincia');
            if (pubLoc?.municipality === candLoc?.municipality) {
              reasons.push('Mismo municipio');
            }
          }
        }

        if (publication.color && candidate.color && 
            publication.color.toLowerCase() === candidate.color.toLowerCase()) {
          reasons.push('Color similar');
        }

        if (publication.size && candidate.size && publication.size === candidate.size) {
          reasons.push('Mismo tamaño');
        }

        if (publication.sex && candidate.sex && publication.sex === candidate.sex) {
          reasons.push('Mismo sexo');
        }

        matches.push({
          publicationId: candidate.id,
          score: Number(score),
          reasons,
        });
      }
    } catch (error) {
      console.error(`Error calculating score for ${candidate.id}:`, error);
    }
  }

  // Ordenar por score y limitar
  matches.sort((a, b) => b.score - a.score);
  const topMatches = matches.slice(0, limit);

  return json(res, 200, {
    ok: true,
    matches: topMatches,
    totalCandidates: candidates.length,
    matchesFound: topMatches.length,
  });
}
