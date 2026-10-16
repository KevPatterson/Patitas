import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from '../_lib/rate-limit-utils';

/**
 * Endpoint para crear un match entre dos publicaciones
 * POST /api/ai/create-match
 * 
 * Body: {
 *   publicationAId: string;
 *   publicationBId: string;
 *   matchType: 'LOST_FOUND' | 'SIGHTING' | 'VISUAL' | 'SEMANTIC';
 *   overallScore: number;
 *   structuredScore?: number;
 *   textScore?: number;
 *   semanticScore?: number;
 *   visualScore?: number;
 *   reasons?: string[];
 * }
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 50 matches por hora
  if (!checkRateLimit(req, res, 'ai-match-create', 50, 3600_000)) {
    return;
  }

  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);

  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Unauthorized' });
  }

  let payload: {
    publicationAId?: string;
    publicationBId?: string;
    matchType?: string;
    overallScore?: number;
    structuredScore?: number;
    textScore?: number;
    semanticScore?: number;
    visualScore?: number;
    reasons?: string[];
  } = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Validaciones
  if (!payload.publicationAId || !payload.publicationBId) {
    return res.status(400).json({ error: 'Missing publication IDs' });
  }

  if (!payload.matchType || !payload.overallScore) {
    return res.status(400).json({ error: 'Missing matchType or overallScore' });
  }

  if (payload.overallScore < 0 || payload.overallScore > 100) {
    return res.status(400).json({ error: 'overallScore must be between 0 and 100' });
  }

  if (payload.publicationAId === payload.publicationBId) {
    return res.status(400).json({ error: 'Cannot match publication with itself' });
  }

  // Asegurar que publication_a_id < publication_b_id para unicidad
  const [pubAId, pubBId] =
    payload.publicationAId < payload.publicationBId
      ? [payload.publicationAId, payload.publicationBId]
      : [payload.publicationBId, payload.publicationAId];

  // Verificar que ambas publicaciones existen
  const { data: publications, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, owner_profile_id')
    .in('id', [pubAId, pubBId])
    .is('deleted_at', null);

  if (pubError || !publications || publications.length !== 2) {
    return res.status(404).json({ error: 'One or both publications not found' });
  }

  // Crear el match
  const { data: match, error: matchError } = await supabaseAdmin
    .from('ai_matches')
    .insert({
      publication_a_id: pubAId,
      publication_b_id: pubBId,
      match_type: payload.matchType,
      overall_score: payload.overallScore,
      structured_score: payload.structuredScore || null,
      text_score: payload.textScore || null,
      semantic_score: payload.semanticScore || null,
      visual_score: payload.visualScore || null,
      status: 'PENDING',
      viewed_by_a: false,
      viewed_by_b: false,
      reasons: payload.reasons || [],
      metadata: {},
    })
    .select('id')
    .single();

  if (matchError) {
    // Puede fallar por constraint de unicidad si el match ya existe
    if (matchError.code === '23505') {
      return res.status(409).json({ error: 'Match already exists' });
    }
    console.error('Error creating match:', matchError);
    return res.status(500).json({ error: 'Failed to create match' });
  }

  // Crear notificaciones para ambos owners (si son diferentes)
  const ownerAId = publications.find((p) => p.id === pubAId)?.owner_profile_id;
  const ownerBId = publications.find((p) => p.id === pubBId)?.owner_profile_id;

  if (ownerAId && ownerBId && ownerAId !== ownerBId) {
    const notifications = [
      {
        profile_id: ownerAId,
        type: 'MATCH',
        title: '¡Posible coincidencia!',
        body: `Encontramos una posible coincidencia para tu publicación (${Math.round(payload.overallScore)}% de similitud).`,
        link: `/publicaciones/${pubAId}`,
        is_read: false,
      },
      {
        profile_id: ownerBId,
        type: 'MATCH',
        title: '¡Posible coincidencia!',
        body: `Encontramos una posible coincidencia para tu publicación (${Math.round(payload.overallScore)}% de similitud).`,
        link: `/publicaciones/${pubBId}`,
        is_read: false,
      },
    ];

    await supabaseAdmin.from('notifications').insert(notifications);

    // Actualizar estado del match
    await supabaseAdmin
      .from('ai_matches')
      .update({ status: 'NOTIFIED', notified_at: new Date().toISOString() })
      .eq('id', match.id);
  }

  return res.status(200).json({
    ok: true,
    message: 'Match created successfully',
    matchId: match.id,
  });
}
