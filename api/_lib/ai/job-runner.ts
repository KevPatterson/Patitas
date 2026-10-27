import { supabaseAdmin } from '../supabase-admin.js';
import { getAIProvider } from '../ai-provider.js';
import { loadOwnStorageImage } from '../image-guard.js';
import { AI_PROVIDER, SUPABASE_URL } from '../env.js';

/**
 * Ejecución de un job de IA.
 *
 * Vive fuera de los handlers porque hay dos rutas que los ejecutan: el endpoint
 * interno `process-job` (pensado para un worker/cron) y `process-publication`,
 * que los ejecuta en la misma petición para que el dueño vea resultados reales
 * al pulsar «Analizar con IA».
 */

export type AIJobRow = {
  id: string;
  publication_id: string;
  job_type: string;
  status: string;
  retry_count: number;
  max_retries: number;
  metadata: Record<string, unknown> | null;
};

export type RunJobResult = {
  ok: boolean;
  jobId: string;
  status: 'COMPLETED' | 'PENDING' | 'FAILED';
  result?: unknown;
  error?: string;
  willRetry?: boolean;
  retryCount?: number;
  processingTime: number;
};

/** Un job solo puede ejecutarse si está pendiente o agotó un intento fallido. */
export function isRunnableJob(job: { status: string }): boolean {
  return job.status === 'PENDING' || job.status === 'FAILED';
}

export async function runAIJob(
  job: AIJobRow,
  options: { allowRetry?: boolean } = {}
): Promise<RunJobResult> {
  const allowRetry = options.allowRetry ?? true;
  const startTime = Date.now();

  await supabaseAdmin
    .from('ai_processing_jobs')
    .update({
      status: 'PROCESSING',
      started_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  try {
    const result = await executeJob(job);
    const processingTime = Date.now() - startTime;

    await supabaseAdmin
      .from('ai_processing_jobs')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        processing_time_ms: processingTime,
        error_message: null,
        metadata: { ...(job.metadata ?? {}), result },
      })
      .eq('id', job.id);

    return {
      ok: true,
      jobId: job.id,
      status: 'COMPLETED',
      result,
      processingTime,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`Job ${job.id} failed:`, errorMessage);

    const shouldRetry = allowRetry && job.retry_count < job.max_retries;
    const newStatus = shouldRetry ? 'PENDING' : 'FAILED';

    await supabaseAdmin
      .from('ai_processing_jobs')
      .update({
        status: newStatus,
        retry_count: job.retry_count + 1,
        error_message: errorMessage,
        processing_time_ms: processingTime,
        completed_at: shouldRetry ? null : new Date().toISOString(),
      })
      .eq('id', job.id);

    return {
      ok: false,
      jobId: job.id,
      status: newStatus,
      error: errorMessage,
      willRetry: shouldRetry,
      retryCount: job.retry_count + 1,
      processingTime,
    };
  }
}

async function executeJob(job: AIJobRow) {
  switch (job.job_type) {
    case 'ocr':
      return processOCRJob(job.publication_id);
    case 'vision':
      return processVisionJob(job.publication_id);
    case 'embedding_text':
      return processTextEmbeddingJob(job.publication_id);
    case 'embedding_image':
      return processImageEmbeddingJob(job.publication_id);
    case 'moderation':
      return processModerationJob(job.publication_id);
    case 'extraction':
      return processExtractionJob(job.publication_id);
    default:
      throw new Error(`Unknown job type: ${job.job_type}`);
  }
}

/** Prefijo público de las imágenes de mascotas en Supabase Storage. */
function publicImageUrl(storagePath: string): string {
  return `${SUPABASE_URL}/storage/v1/object/public/pet-images/${storagePath}`;
}

/**
 * Procesar OCR en imágenes de la publicación
 */
async function processOCRJob(publicationId: string) {
  const provider = getAIProvider();

  // Obtener imágenes de la publicación
  const { data: images, error: imgError } = await supabaseAdmin
    .from('publication_images')
    .select('id, storage_path')
    .eq('publication_id', publicationId)
    .limit(5); // Máximo 5 imágenes por publicación

  if (imgError || !images || images.length === 0) {
    throw new Error('No images found for publication');
  }

  const results = [];

  for (const image of images) {
    const imageUrl = publicImageUrl(image.storage_path);

    try {
      const prepared = await loadOwnStorageImage(imageUrl);
      if (!prepared.ok) throw new Error(prepared.reason);

      const ocrResult = await provider.extractTextFromImage(prepared.image);

      // Guardar resultado en la base de datos
      const { error: insertError } = await supabaseAdmin
        .from('ai_ocr_results')
        .insert({
          publication_image_id: image.id,
          provider: AI_PROVIDER,
          model: 'llava-1.5-7b-hf',
          extracted_text: ocrResult.text,
          confidence: ocrResult.confidence,
          language: ocrResult.language,
          bounding_boxes: ocrResult.boundingBoxes || null,
        });

      if (insertError) {
        console.error('Error saving OCR result:', insertError);
      }

      results.push({
        imageId: image.id,
        text: ocrResult.text,
        confidence: ocrResult.confidence,
      });
    } catch (error) {
      console.error(`OCR failed for image ${image.id}:`, error);
      results.push({
        imageId: image.id,
        error: error instanceof Error ? error.message : 'OCR failed',
      });
    }
  }

  return { imagesProcessed: images.length, results };
}

/**
 * Procesar Computer Vision en imágenes
 */
async function processVisionJob(publicationId: string) {
  const provider = getAIProvider();

  const { data: images, error: imgError } = await supabaseAdmin
    .from('publication_images')
    .select('id, storage_path')
    .eq('publication_id', publicationId)
    .limit(5);

  if (imgError || !images || images.length === 0) {
    throw new Error('No images found for publication');
  }

  const results = [];

  for (const image of images) {
    const imageUrl = publicImageUrl(image.storage_path);

    try {
      const prepared = await loadOwnStorageImage(imageUrl);
      if (!prepared.ok) throw new Error(prepared.reason);

      const visionResult = await provider.analyzeImage(prepared.image);

      // Crear registro de vision result
      const { data: visionRecord, error: visionError } = await supabaseAdmin
        .from('ai_vision_results')
        .insert({
          publication_image_id: image.id,
          provider: AI_PROVIDER,
          model: 'llava-1.5-7b-hf',
          metadata: {
            description: visionResult.description,
            objects: visionResult.objects,
          },
        })
        .select('id')
        .single();

      if (visionError) {
        throw visionError;
      }

      // Guardar atributos extraídos
      const attributes = visionResult.labels.map((label: { label: string; confidence: number }) => ({
        vision_result_id: visionRecord.id,
        publication_id: publicationId,
        attribute_key: label.label,
        attribute_value: label.label,
        confidence: label.confidence,
        source: 'vision',
      }));

      if (attributes.length > 0) {
        await supabaseAdmin.from('ai_extracted_attributes').insert(attributes);
      }

      results.push({
        imageId: image.id,
        labels: visionResult.labels,
        description: visionResult.description,
      });
    } catch (error) {
      console.error(`Vision failed for image ${image.id}:`, error);
      results.push({
        imageId: image.id,
        error: error instanceof Error ? error.message : 'Vision failed',
      });
    }
  }

  return { imagesProcessed: images.length, results };
}

/**
 * Generar embedding de texto
 */
async function processTextEmbeddingJob(publicationId: string) {
  const provider = getAIProvider();

  // Obtener publicación
  const { data: publication, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, title, description, species, breed, color, characteristics')
    .eq('id', publicationId)
    .single();

  if (pubError || !publication) {
    throw new Error('Publication not found');
  }

  // Combinar texto relevante
  const textParts = [
    publication.title,
    publication.description,
    publication.species,
    publication.breed,
    publication.color,
    publication.characteristics,
  ].filter(Boolean);

  const combinedText = textParts.join(' ');

  const embeddingResult = await provider.generateTextEmbedding(combinedText);

  // Guardar embedding. El `onConflict` debe coincidir con el índice único
  // (publication_id, text_source, model): sin él, analizar dos veces la misma
  // publicación fallaba por clave duplicada.
  const { error: upsertError } = await supabaseAdmin
    .from('ai_text_embeddings')
    .upsert(
      {
        publication_id: publicationId,
        provider: AI_PROVIDER,
        model: 'bge-base-en-v1.5',
        embedding_dimension: embeddingResult.dimension,
        embedding: embeddingResult.embedding,
        embedding_data: embeddingResult.embedding, // Fallback JSON
        text_source: 'combined',
      },
      { onConflict: 'publication_id,text_source,model' }
    );

  if (upsertError) {
    throw upsertError;
  }

  return {
    dimension: embeddingResult.dimension,
    textLength: combinedText.length,
  };
}

/**
 * Generar embedding de imagen
 */
async function processImageEmbeddingJob(publicationId: string) {
  const provider = getAIProvider();

  const { data: coverImage, error: imgError } = await supabaseAdmin
    .from('publication_images')
    .select('id, storage_path')
    .eq('publication_id', publicationId)
    .eq('is_cover', true)
    .maybeSingle();

  // Si no hay cover, tomar la primera
  let image = coverImage;

  if (imgError || !image) {
    const { data: firstImage } = await supabaseAdmin
      .from('publication_images')
      .select('id, storage_path')
      .eq('publication_id', publicationId)
      .limit(1)
      .single();

    if (!firstImage) {
      throw new Error('No images found');
    }

    image = firstImage;
  }

  const prepared = await loadOwnStorageImage(publicImageUrl(image.storage_path));
  if (!prepared.ok) throw new Error(prepared.reason);

  const embeddingResult = await provider.generateImageEmbedding(prepared.image);

  const { error: upsertError } = await supabaseAdmin
    .from('ai_image_embeddings')
    .upsert(
      {
        publication_image_id: image.id,
        provider: AI_PROVIDER,
        model: 'resnet-50',
        embedding_dimension: embeddingResult.dimension,
        embedding: embeddingResult.embedding,
        embedding_data: embeddingResult.embedding,
      },
      { onConflict: 'publication_image_id,model' }
    );

  if (upsertError) {
    throw upsertError;
  }

  return { dimension: embeddingResult.dimension };
}

/**
 * Moderar contenido
 */
async function processModerationJob(publicationId: string) {
  const provider = getAIProvider();

  const { data: publication, error: pubError } = await supabaseAdmin
    .from('publications')
    .select('id, title, description')
    .eq('id', publicationId)
    .single();

  if (pubError || !publication) {
    throw new Error('Publication not found');
  }

  const textToModerate = `${publication.title} ${publication.description}`;
  const moderationResult = await provider.moderateContent(textToModerate);

  // Guardar resultado
  const { error: insertError } = await supabaseAdmin
    .from('ai_moderation_results')
    .insert({
      publication_id: publicationId,
      provider: AI_PROVIDER,
      model: 'llama-3-8b-instruct',
      classification: moderationResult.classification,
      confidence: moderationResult.confidence,
      reason: moderationResult.reason,
      requires_human_review:
        moderationResult.confidence < 0.85 || moderationResult.classification !== 'SAFE',
      metadata: { categories: moderationResult.categories },
    });

  if (insertError) {
    throw insertError;
  }

  return {
    classification: moderationResult.classification,
    confidence: moderationResult.confidence,
    requiresReview: moderationResult.confidence < 0.85,
  };
}

/**
 * Extraer atributos estructurados (combinando OCR + Vision)
 */
async function processExtractionJob(publicationId: string) {
  // Este job combina resultados de OCR y Vision para extraer atributos estructurados
  const { data: ocrResults } = await supabaseAdmin
    .from('ai_ocr_results')
    .select('extracted_text')
    .eq('publication_image_id', publicationId);

  const { data: visionResults } = await supabaseAdmin
    .from('ai_vision_results')
    .select('metadata')
    .eq('publication_image_id', publicationId);

  // Aquí se implementaría la lógica para extraer atributos estructurados
  // Por ejemplo: detectar teléfonos, fechas, ubicaciones, etc.

  return {
    ocrCount: ocrResults?.length || 0,
    visionCount: visionResults?.length || 0,
  };
}
