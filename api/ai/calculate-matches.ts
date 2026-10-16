import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from '../_lib/rate-limit-utils';

/**
 * Endpoint para calcular matches para una publicación
 * POST /api/ai/calculate-matches
 * 
 * Body: {
 *   publicationId: string;
 *   minScore?: number; // Default: 60
 *   limit?: number; // Default: 10
 * }
 * 
 * Calcula matches estructurados y devuelve candidatos
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting: 30 cálculos por hora
  if (!checkRateLimit(req, res, 'ai-calculate-matches', 30, 3600_000)) {
    return;
  }

  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);

  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Unauthorized' });
  }

  let payload: { publicationId?: string; minScore?: number; limit?: number } = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!payload.publicationId) {
    return res.status(400).json({ error: 'Missing publicationId' });
  }

  const minScore = payload.minScore ?? 60;
  const limit = payload.limit ?? 10;

  // Obtener la publicación
  const { data: publication, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, type, species, breed, sex, size, color, event_date, location:locations(province, municipality)')
    .eq('id', payload.publicationId)
    .is('deleted_at', null)
    .single();

  if (pubError || !publication) {
    return res.status(404).json({ error: 'Publication not found' });
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
    .neq('id', payload.publicationId)
    .limit(100);

  if (candidatesError) {
    return res.status(500).json({ error: 'Failed to fetch candidates' });
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
        pub_a_id: payload.publicationId,
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

  return res.status(200).json({
    ok: true,
    matches: topMatches,
    totalCandidates: candidates.length,
    matchesFound: topMatches.length,
  });
}
