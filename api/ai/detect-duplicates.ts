import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from '../_lib/rate-limit-utils';

/**
 * Endpoint para detectar posibles duplicados de una publicación
 * POST /api/ai/detect-duplicates
 * 
 * Body: {
 *   publicationId: string;
 *   threshold?: number; // Default: 0.7
 * }
 * 
 * Retorna publicaciones que podrían ser duplicados
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limiting
  if (!checkRateLimit(req, res, 'ai-detect-duplicates', 20, 3600_000)) {
    return;
  }

  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);

  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Unauthorized' });
  }

  let payload: { publicationId?: string; threshold?: number } = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!payload.publicationId) {
    return res.status(400).json({ error: 'Missing publicationId' });
  }

  const threshold = payload.threshold ?? 0.7;

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
    .eq('id', payload.publicationId)
    .is('deleted_at', null)
    .single();

  if (pubError || !publication) {
    return res.status(404).json({ error: 'Publication not found' });
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
    .neq('id', payload.publicationId)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Últimos 90 días
    .limit(50);

  if (candidatesError) {
    return res.status(500).json({ error: 'Failed to fetch candidates' });
  }

  if (!candidates || candidates.length === 0) {
    return res.status(200).json({ ok: true, duplicates: [] });
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

  return res.status(200).json({
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
