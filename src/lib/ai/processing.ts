// Servicio de procesamiento automático de publicaciones con IA

import { supabase } from '../supabase/client';
import type { ExtractedAttribute, OCRResult, VisionResult, AIProcessingJob, AIJobStatus, AIJobType } from './types';

export type ProcessingStatus = {
  ocr: 'pending' | 'processing' | 'completed' | 'failed';
  vision: 'pending' | 'processing' | 'completed' | 'failed';
  embedding: 'pending' | 'processing' | 'completed' | 'failed';
  moderation: 'pending' | 'processing' | 'completed' | 'failed';
  overall: 'pending' | 'processing' | 'completed' | 'partial' | 'failed';
};

/**
 * Iniciar procesamiento de IA para una publicación
 */
export async function startProcessing(
  publicationId: string,
  tasks?: AIJobType[]
): Promise<{ ok: boolean; jobs?: Array<{ id: string; job_type: string }> }> {
  const { data: session } = await supabase.auth.getSession();

  if (!session.session) {
    throw new Error('No hay sesión activa');
  }

  // El router de IA expone las acciones por query string. Antes se llamaba a
  // `/api/ai/process-publication`, que no existe y devolvía 405 con el cuerpo
  // vacío; `response.json()` lanzaba "Unexpected end of JSON input".
  const response = await fetch('/api/ai?action=process-publication', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.session.access_token}`,
    },
    body: JSON.stringify({ publicationId, tasks }),
  });

  const raw = await response.text();
  let payload: unknown;

  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  const errorMessage =
    payload && typeof payload === 'object' && 'error' in payload
      ? String((payload as { error?: unknown }).error)
      : `Error ${response.status} al iniciar el procesamiento`;

  if (!response.ok) {
    throw new Error(errorMessage);
  }

  if (!payload || typeof payload !== 'object') {
    throw new Error('El servidor no devolvió una respuesta válida');
  }

  const result = payload as {
    ok?: boolean;
    error?: string;
    jobs?: Array<{ id: string; job_type: string }>;
  };

  if (result.ok === false) {
    throw new Error(result.error ?? 'No se pudo iniciar el procesamiento');
  }

  return { ok: true, jobs: result.jobs };
}

// Obtener estado de procesamiento de una publicación
export async function getProcessingStatus(publicationId: string): Promise<ProcessingStatus> {
  const { data: jobs } = await supabase
    .from('ai_processing_jobs')
    .select('job_type, status')
    .eq('publication_id', publicationId);

  if (!jobs || jobs.length === 0) {
    return {
      ocr: 'pending',
      vision: 'pending',
      embedding: 'pending',
      moderation: 'pending',
      overall: 'pending',
    };
  }

  const statusMap: ProcessingStatus = {
    ocr: 'pending',
    vision: 'pending',
    embedding: 'pending',
    moderation: 'pending',
    overall: 'pending',
  };

  for (const job of jobs) {
    const type = job.job_type;
    const status = job.status.toLowerCase() as 'pending' | 'processing' | 'completed' | 'failed';
    
    if (type === 'ocr') statusMap.ocr = status;
    else if (type === 'vision') statusMap.vision = status;
    else if (type === 'embedding_text' || type === 'embedding_image') {
      if (statusMap.embedding === 'pending' || status === 'completed') {
        statusMap.embedding = status;
      }
    }
    else if (type === 'moderation') statusMap.moderation = status;
  }

  // Calcular estado general
  const statuses = [statusMap.ocr, statusMap.vision, statusMap.embedding, statusMap.moderation];
  let overall: ProcessingStatus['overall'] = 'pending';

  if (statuses.every(s => s === 'completed')) {
    overall = 'completed';
  } else if (statuses.some(s => s === 'processing')) {
    overall = 'processing';
  } else if (statuses.some(s => s === 'completed') && statuses.some(s => s === 'failed')) {
    overall = 'partial';
  } else if (statuses.every(s => s === 'failed')) {
    overall = 'failed';
  }

  statusMap.overall = overall;

  return statusMap;
}

/**
 * Obtener jobs de procesamiento de una publicación
 */
export async function getProcessingJobs(publicationId: string): Promise<AIProcessingJob[]> {
  const { data, error } = await supabase
    .from('ai_processing_jobs')
    .select('*')
    .eq('publication_id', publicationId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching processing jobs:', error);
    return [];
  }

  return (data as AIProcessingJob[]) || [];
}

/**
 * Reintentar un job fallido
 */
export async function retryJob(jobId: string): Promise<void> {
  const { error } = await supabase
    .from('ai_processing_jobs')
    .update({
      status: 'PENDING' as AIJobStatus,
      error_message: null,
    })
    .eq('id', jobId);

  if (error) {
    throw error;
  }
}

// Obtener atributos extraídos automáticamente
export async function getExtractedAttributes(
  publicationId: string
): Promise<ExtractedAttribute[]> {
  const { data, error } = await supabase
    .from('ai_extracted_attributes')
    .select('*')
    .eq('publication_id', publicationId)
    .order('confidence', { ascending: false });

  if (error) {
    console.error('Error fetching extracted attributes:', error);
    return [];
  }

  return (data as ExtractedAttribute[]) || [];
}

// Obtener resultados de OCR para una publicación
export async function getOCRResults(publicationId: string): Promise<Array<OCRResult & { image_id: string }>> {
  const { data, error } = await supabase
    .from('ai_ocr_results')
    .select(`
      *,
      publication_image:publication_images!publication_image_id(id, publication_id)
    `)
    .eq('publication_image.publication_id', publicationId);

  if (error) {
    console.error('Error fetching OCR results:', error);
    return [];
  }

  return (data?.map((item: {
    id: string;
    publication_image_id: string;
    provider: string;
    created_at: string;
    metadata: Record<string, unknown>;
    publication_image: { id: string } | { id: string }[] | null;
  }) => ({
    ...item,
    image_id: Array.isArray(item.publication_image) 
      ? item.publication_image[0]?.id 
      : item.publication_image?.id,
  })) || []) as Array<OCRResult & { image_id: string }>;
}

// Obtener resultados de Vision para una publicación
export async function getVisionResults(publicationId: string): Promise<Array<VisionResult & { image_id: string }>> {
  const { data, error } = await supabase
    .from('ai_vision_results')
    .select(`
      *,
      publication_image:publication_images!publication_image_id(id, publication_id)
    `)
    .eq('publication_image.publication_id', publicationId);

  if (error) {
    console.error('Error fetching vision results:', error);
    return [];
  }

  return (data?.map((item: {
    id: string;
    publication_image_id: string;
    provider: string;
    model: string;
    created_at: string;
    metadata: Record<string, unknown>;
    publication_image: { id: string } | { id: string }[] | null;
  }) => ({
    ...item,
    image_id: Array.isArray(item.publication_image)
      ? item.publication_image[0]?.id
      : item.publication_image?.id,
  })) || []) as Array<VisionResult & { image_id: string }>;
}

// Agrupar atributos por clave
export function groupAttributesByKey(
  attributes: ExtractedAttribute[]
): Record<string, Array<{ value: string; confidence: number; source: string }>> {
  const grouped: Record<string, Array<{ value: string; confidence: number; source: string }>> = {};

  for (const attr of attributes) {
    if (!grouped[attr.attribute_key]) {
      grouped[attr.attribute_key] = [];
    }
    grouped[attr.attribute_key].push({
      value: attr.attribute_value,
      confidence: attr.confidence,
      source: attr.source,
    });
  }

  // Ordenar por confidence dentro de cada grupo
  for (const key in grouped) {
    grouped[key].sort((a, b) => b.confidence - a.confidence);
  }

  return grouped;
}

// Obtener el valor más probable de un atributo
export function getMostProbableValue(
  attributes: ExtractedAttribute[],
  key: string
): { value: string; confidence: number } | null {
  const matching = attributes.filter(a => a.attribute_key === key);
  
  if (matching.length === 0) {
    return null;
  }

  // Ordenar por confidence
  matching.sort((a, b) => b.confidence - a.confidence);
  
  return {
    value: matching[0].attribute_value,
    confidence: matching[0].confidence,
  };
}

// Crear sugerencias para el usuario basadas en atributos extraídos
export type AttributeSuggestion = {
  field: string;
  value: string;
  confidence: number;
  source: string;
  applied: boolean;
};

export function createSuggestions(
  attributes: ExtractedAttribute[],
  threshold = 0.7
): AttributeSuggestion[] {
  const grouped = groupAttributesByKey(attributes);
  const suggestions: AttributeSuggestion[] = [];

  // Mapeo de claves de atributos a campos de formulario
  const fieldMapping: Record<string, string> = {
    species: 'species',
    breed: 'breed',
    color: 'color',
    sex: 'sex',
    size: 'size',
    collar: 'collar',
    plate: 'plate',
    phone: 'contactPhone',
    whatsapp: 'contactWhatsapp',
    email: 'contactEmail',
    pet_name: 'petName',
  };

  for (const [key, values] of Object.entries(grouped)) {
    const fieldName = fieldMapping[key];
    if (!fieldName) continue;

    const topValue = values[0];
    if (topValue.confidence >= threshold) {
      suggestions.push({
        field: fieldName,
        value: topValue.value,
        confidence: topValue.confidence,
        source: topValue.source,
        applied: false,
      });
    }
  }

  return suggestions;
}

// Suscribirse a cambios en el estado de procesamiento (Realtime)
export function subscribeToProcessingStatus(
  publicationId: string,
  callback: (status: ProcessingStatus) => void
) {
  const channel = supabase
    .channel(`ai-processing:${publicationId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'ai_processing_jobs',
        filter: `publication_id=eq.${publicationId}`,
      },
      async () => {
        const status = await getProcessingStatus(publicationId);
        callback(status);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

// Verificar si hay resultados de moderación que requieren revisión
export async function needsModerationReview(publicationId: string): Promise<boolean> {
  const { data } = await supabase
    .from('ai_moderation_results')
    .select('id')
    .eq('publication_id', publicationId)
    .eq('requires_human_review', true)
    .is('reviewed_at', null)
    .limit(1)
    .maybeSingle();

  return !!data;
}

// Obtener clasificación de moderación
export async function getModerationClassification(publicationId: string) {
  const { data } = await supabase
    .from('ai_moderation_results')
    .select('classification, confidence, reason')
    .eq('publication_id', publicationId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}
