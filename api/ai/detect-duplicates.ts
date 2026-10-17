import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { fail, internalError, json, parseBody, requireAuth, rejectMethod } from '../_lib/http';
import { limitAiByUser, limitByIp } from '../_lib/rate-limit-utils';
import { canManagePublication, getActor, loadPublication } from '../_lib/authz';

/**
 * POST /api/ai/detect-duplicates — busca publicaciones duplicadas de una dada.
 *
 * Hallazgo API-02 (IDOR): igual que `calculate-matches`, no comprobaba la
 * propiedad: cualquiera podía leer metadatos de publicaciones ajenas **y además
 * escribir** filas en `duplicate_detections` en su nombre. Se exige dueño o
 * moderador, se valida el body con Zod y se aplica cuota por usuario.
 */

const detectSchema = z.object({
  publicationId: z.string().uuid('El identificador de la publicación no es válido'),
  threshold: z.number().min(0).max(1).optional(),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'ai-duplicates-ip', 60, 3600_000);
  if (!ipLimit.ok) return;

  const auth = await requireAuth(req, supabaseAdmin);
  if (!auth.ok) {
    return fail(res, auth.status, auth.code, auth.message);
  }

  const userLimit = await limitAiByUser(res, auth.user.id);
  if (!userLimit.ok) return;

  const parsed = parseBody(req, detectSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const threshold = parsed.data.threshold ?? 0.7;
  const publicationId = parsed.data.publicationId;

  const ownership = await loadPublication(supabaseAdmin, publicationId);

  if (!ownership) {
    return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
  }

  const actor = await getActor(supabaseAdmin, auth.user.id);

  if (!canManagePublication(actor, ownership)) {
    return fail(
      res,
      403,
      'FORBIDDEN',
      'Solo el dueño de la publicación puede analizar duplicados'
    );
  }

  // Obtener la publicación
  const { data: publication, error: pubError } = await supabaseAdmin
    .from('publications')
    .select(`
      id, 
      type, 
      title, 
      description, 
      species, 
      breed, 
      color, 
      event_date,
      location:locations(province, municipality),
      publication_images(id, storage_path)
    `)
    .eq('id', publicationId)
    .is('deleted_at', null)
    .single();

  if (pubError || !publication) {
    return fail(res, 404, 'NOT_FOUND', 'Publicación no encontrada');
  }

  // Buscar publicaciones similares (misma especie, mismo tipo, creadas recientemente)
  const { data: candidates, error: candidatesError } = await supabaseAdmin
    .from('publications')
    .select(`
      id, 
      title, 
      description, 
      species,
      event_date,
      location:locations(province, municipality),
      publication_images(id, storage_path)
    `)
    .eq('type', publication.type)
    .eq('species', publication.species)
    .in('status', ['ACTIVE', 'RESOLVED'])
    .is('deleted_at', null)
    .neq('id', publicationId)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 90 días
    .limit(50);

  if (candidatesError) {
    return internalError(res, 'detect-duplicates/candidates', candidatesError);
  }

  if (!candidates || candidates.length === 0) {
    return json(res, 200, { ok: true, duplicates: [] });
  }

  // Calcular similitud para cada candidato
  const duplicates: Array<{
    publicationId: string;
    similarityScore: number;
    duplicateProbability: number;
    reasons: string[];
  }> = [];

  for (const candidate of candidates) {
    const result = calculateSimilarity(publication, candidate);

    if (result.duplicateProbability >= threshold) {
      duplicates.push({
        publicationId: candidate.id,
        similarityScore: result.similarityScore,
        duplicateProbability: result.duplicateProbability,
        reasons: result.reasons,
      });

      // Guardar detección en la base de datos
      const [pubAId, pubBId] =
        publication.id < candidate.id
          ? [publication.id, candidate.id]
          : [candidate.id, publication.id];

      await supabaseAdmin.from('duplicate_detections').upsert({
        publication_a_id: pubAId,
        publication_b_id: pubBId,
        similarity_score: result.similarityScore,
        same_image_hash: result.sameImageHash,
        similar_image: result.similarImage,
        same_text: result.sameText,
        similar_text: result.similarText,
        same_location: result.sameLocation,
        same_date: result.sameDate,
        duplicate_probability: result.duplicateProbability,
        reviewed: false,
        metadata: {},
      });
    }
  }

  // Ordenar por probabilidad descendente
  duplicates.sort((a, b) => b.duplicateProbability - a.duplicateProbability);

  return json(res, 200, {
    ok: true,
    duplicates,
    totalCandidates: candidates.length,
  });
}

/**
 * Calcular similitud entre dos publicaciones
 */
function calculateSimilarity(
  pubA: {
    title: string;
    description: string | null;
    event_date: string | null;
    location: Array<{ province: string; municipality: string }> | null;
    publication_images: Array<{ storage_path: string }> | null;
  },
  pubB: {
    title: string;
    description: string | null;
    event_date: string | null;
    location: Array<{ province: string; municipality: string }> | null;
    publication_images: Array<{ storage_path: string }> | null;
  }
): {
  similarityScore: number;
  duplicateProbability: number;
  sameImageHash: boolean;
  similarImage: boolean;
  sameText: boolean;
  similarText: boolean;
  sameLocation: boolean;
  sameDate: boolean;
  reasons: string[];
} {
  const reasons: string[] = [];
  let score = 0;

  // Similitud de título (peso: 30)
  const titleSimilarity = calculateTextSimilarity(pubA.title, pubB.title);
  if (titleSimilarity > 0.9) {
    score += 30;
    reasons.push('Título idéntico');
  } else if (titleSimilarity > 0.7) {
    score += 20;
    reasons.push('Título muy similar');
  } else if (titleSimilarity > 0.5) {
    score += 10;
  }

  // Similitud de descripción (peso: 25)
  if (pubA.description && pubB.description) {
    const descSimilarity = calculateTextSimilarity(pubA.description, pubB.description);
    if (descSimilarity > 0.8) {
      score += 25;
      reasons.push('Descripción similar');
    } else if (descSimilarity > 0.6) {
      score += 15;
    }
  }

  // Similitud de ubicación (peso: 20)
  const locA = pubA.location?.[0];
  const locB = pubB.location?.[0];

  if (locA && locB) {
    if (
      locA.province === locB.province &&
      locA.municipality === locB.municipality
    ) {
      score += 20;
      reasons.push('Misma ubicación');
    } else if (locA.province === locB.province) {
      score += 10;
    }
  }

  // Similitud de fecha (peso: 15)
  if (pubA.event_date && pubB.event_date) {
    const dateA = new Date(pubA.event_date);
    const dateB = new Date(pubB.event_date);
    const diffDays = Math.abs(
      (dateA.getTime() - dateB.getTime()) / (24 * 60 * 60 * 1000)
    );

    if (diffDays === 0) {
      score += 15;
      reasons.push('Misma fecha');
    } else if (diffDays <= 3) {
      score += 10;
    } else if (diffDays <= 7) {
      score += 5;
    }
  }

  // Similitud de imagen (peso: 10)
  // En producción, esto debería usar perceptual hash o embeddings
  const imgA = pubA.publication_images?.[0]?.storage_path;
  const imgB = pubB.publication_images?.[0]?.storage_path;

  if (imgA && imgB) {
    // Mock: Comparar paths (en producción, usar hash real)
    if (imgA === imgB) {
      score += 10;
      reasons.push('Misma imagen');
    }
  }

  // Normalizar score a 0-100
  const similarityScore = Math.min(score, 100);

  // Calcular probabilidad de duplicado
  let probability = 0;

  if (similarityScore >= 90) probability = 0.95;
  else if (similarityScore >= 80) probability = 0.85;
  else if (similarityScore >= 70) probability = 0.75;
  else if (similarityScore >= 60) probability = 0.65;
  else if (similarityScore >= 50) probability = 0.5;
  else probability = similarityScore / 100;

  return {
    similarityScore,
    duplicateProbability: probability,
    sameImageHash: imgA === imgB,
    similarImage: false, // Mock
    sameText: titleSimilarity > 0.95,
    similarText: titleSimilarity > 0.7,
    sameLocation: Boolean(
      locA &&
        locB &&
        locA.province === locB.province &&
        locA.municipality === locB.municipality
    ),
    sameDate: Boolean(
      pubA.event_date &&
        pubB.event_date &&
        pubA.event_date === pubB.event_date
    ),
    reasons,
  };
}

/**
 * Calcular similitud de texto simple (Jaccard)
 */
function calculateTextSimilarity(textA: string, textB: string): number {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(Boolean);

  const wordsA = new Set(normalize(textA));
  const wordsB = new Set(normalize(textB));

  if (wordsA.size === 0 && wordsB.size === 0) return 1;
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  const intersection = new Set([...wordsA].filter((w) => wordsB.has(w)));
  const union = new Set([...wordsA, ...wordsB]);

  return intersection.size / union.size;
}
