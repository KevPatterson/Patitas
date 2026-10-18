import { z } from 'zod';
import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { getAIProvider } from '../_lib/ai-provider';
import { loadOwnStorageImage } from '../_lib/image-guard';
import { fail, parseBody, rejectMethod } from '../_lib/http';
import { limitByIp } from '../_lib/rate-limit-utils';
import { AI_ENABLED, INTERNAL_API_KEY } from '../_lib/env';
import { safeEqual } from '../_lib/authz';

/**
 * POST /api/ai/process-job — procesa un job de IA concreto. Lo invoca el
 * worker/cron, nunca el navegador.
 *
 * Hallazgo API-09: la API key se comparaba con `authHeader !== \`Bearer ${apiKey}\``,
 * una comparación que corta en el primer byte distinto y por tanto filtra
 * información por temporización. Ahora se usa una comparación de tiempo constante.
 *
 * El body además se valida con Zod.
 */

const processJobSchema = z.object({
  jobId: z.string().uuid('El identificador del job no es válido'),
});

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (rejectMethod(req, res, 'POST')) return;

  const ipLimit = await limitByIp(req, res, 'process-job-ip', 120, 60_000);
  if (!ipLimit.ok) return;

  // Autorización interna con comparación de tiempo constante.
  const apiKey = INTERNAL_API_KEY;
  const authHeader = req.headers.authorization ?? '';
  const expected = apiKey ? `Bearer ${apiKey}` : '';

  if (!apiKey || !safeEqual(authHeader, expected)) {
    return fail(res, 401, 'UNAUTHORIZED', 'No autorizado');
  }

  if (!AI_ENABLED) {
    return fail(res, 503, 'INTERNAL', 'El procesamiento con IA está desactivado');
  }

  const parsed = parseBody(req, processJobSchema);
  if (!parsed.ok) {
    return fail(res, parsed.status, parsed.code, parsed.message, { issues: parsed.issues });
  }

  const jobId = parsed.data.jobId;

  // Obtener el job
  const { data: job, error: jobError } = await supabaseAdmin
    .from('ai_processing_jobs')
    .select('*')
    .eq('id', jobId)
    .single();

  if (jobError || !job) {
    return fail(res, 404, 'NOT_FOUND', 'Job no encontrado');
  }

  // Verificar que el job esté pendiente o en estado de reintento
  if (job.status !== 'PENDING' && job.status !== 'FAILED') {
    return fail(res, 409, 'CONFLICT', `El job está en estado ${job.status} y no se puede procesar`);
  }

  // Actualizar estado a PROCESSING
  const startTime = Date.now();

  await supabaseAdmin
    .from('ai_processing_jobs')
    .update({
      status: 'PROCESSING',
      started_at: new Date().toISOString(),
    })
    .eq('id', job.id);

  try {
    // Procesar según el tipo de job
    let result;

    switch (job.job_type) {
      case 'ocr':
        result = await processOCRJob(job.publication_id);
        break;
      case 'vision':
        result = await processVisionJob(job.publication_id);
        break;
      case 'embedding_text':
        result = await processTextEmbeddingJob(job.publication_id);
        break;
      case 'embedding_image':
        result = await processImageEmbeddingJob(job.publication_id);
        break;
      case 'moderation':
        result = await processModerationJob(job.publication_id);
        break;
      case 'extraction':
        result = await processExtractionJob(job.publication_id);
        break;
      default:
        throw new Error(`Unknown job type: ${job.job_type}`);
    }

    const processingTime = Date.now() - startTime;

    // Actualizar job como completado
    await supabaseAdmin
      .from('ai_processing_jobs')
      .update({
        status: 'COMPLETED',
        completed_at: new Date().toISOString(),
        processing_time_ms: processingTime,
        metadata: { ...job.metadata, result },
      })
      .eq('id', job.id);

    return res.status(200).json({
      ok: true,
      jobId: job.id,
      status: 'COMPLETED',
      processingTime,
      result,
    });
  } catch (error) {
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    console.error(`Job ${job.id} failed:`, errorMessage);

    // Verificar si debe reintentar
    const shouldRetry = job.retry_count < job.max_retries;
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

    return res.status(500).json({
      ok: false,
      error: errorMessage,
      jobId: job.id,
      willRetry: shouldRetry,
      retryCount: job.retry_count + 1,
    });
  }
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
    const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/pet-images/${image.storage_path}`;

    try {
      const prepared = await loadOwnStorageImage(imageUrl);
      if (!prepared.ok) throw new Error(prepared.reason);

      const ocrResult = await provider.extractTextFromImage(prepared.image);

      // Guardar resultado en la base de datos
      const { error: insertError } = await supabaseAdmin
        .from('ai_ocr_results')
        .insert({
          publication_image_id: image.id,
          provider: process.env.AI_PROVIDER || 'MOCK',
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
    const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/pet-images/${image.storage_path}`;

    try {
      const prepared = await loadOwnStorageImage(imageUrl);
      if (!prepared.ok) throw new Error(prepared.reason);

      const visionResult = await provider.analyzeImage(prepared.image);

      // Crear registro de vision result
      const { data: visionRecord, error: visionError } = await supabaseAdmin
        .from('ai_vision_results')
        .insert({
          publication_image_id: image.id,
          provider: process.env.AI_PROVIDER || 'MOCK',
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
      const attributes = visionResult.labels.map((label) => ({
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

  // Guardar embedding
  await supabaseAdmin
    .from('ai_text_embeddings')
    .upsert({
      publication_id: publicationId,
      provider: process.env.AI_PROVIDER || 'MOCK',
      model: 'bge-base-en-v1.5',
      embedding_dimension: embeddingResult.dimension,
      embedding: embeddingResult.embedding,
      embedding_data: embeddingResult.embedding, // Fallback JSON
      text_source: 'combined',
    });

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

  const { data: images, error: imgError } = await supabaseAdmin
    .from('publication_images')
    .select('id, storage_path')
    .eq('publication_id', publicationId)
    .eq('is_cover', true)
    .maybeSingle();

  if (imgError || !images) {
    // Si no hay cover, tomar la primera
    const { data: firstImage } = await supabaseAdmin
      .from('publication_images')
      .select('id, storage_path')
      .eq('publication_id', publicationId)
      .limit(1)
      .single();

    if (!firstImage) {
      throw new Error('No images found');
    }

    const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/pet-images/${firstImage.storage_path}`;
    const prepared = await loadOwnStorageImage(imageUrl);
    if (!prepared.ok) throw new Error(prepared.reason);

    const embeddingResult = await provider.generateImageEmbedding(prepared.image);

    await supabaseAdmin
      .from('ai_image_embeddings')
      .upsert({
        publication_image_id: firstImage.id,
        provider: process.env.AI_PROVIDER || 'MOCK',
        model: 'resnet-50',
        embedding_dimension: embeddingResult.dimension,
        embedding: embeddingResult.embedding,
        embedding_data: embeddingResult.embedding,
      });

    return { dimension: embeddingResult.dimension };
  }

  const imageUrl = `${process.env.SUPABASE_URL}/storage/v1/object/public/pet-images/${images.storage_path}`;
  const prepared = await loadOwnStorageImage(imageUrl);
  if (!prepared.ok) throw new Error(prepared.reason);

  const embeddingResult = await provider.generateImageEmbedding(prepared.image);

  await supabaseAdmin
    .from('ai_image_embeddings')
    .upsert({
      publication_image_id: images.id,
      provider: process.env.AI_PROVIDER || 'MOCK',
      model: 'resnet-50',
      embedding_dimension: embeddingResult.dimension,
      embedding: embeddingResult.embedding,
      embedding_data: embeddingResult.embedding,
    });

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
  await supabaseAdmin
    .from('ai_moderation_results')
    .insert({
      publication_id: publicationId,
      provider: process.env.AI_PROVIDER || 'MOCK',
      model: 'llama-3-8b-instruct',
      classification: moderationResult.classification,
      confidence: moderationResult.confidence,
      reason: moderationResult.reason,
      requires_human_review: moderationResult.confidence < 0.85 || moderationResult.classification !== 'SAFE',
      metadata: { categories: moderationResult.categories },
    });

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
