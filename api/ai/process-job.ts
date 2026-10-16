import type { VercelRequest, VercelResponse } from '../types/vercel';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { getAIProvider } from '../_lib/ai-provider';

/**
 * Endpoint para procesar un job de IA específico
 * POST /api/ai/process-job
 * 
 * Body: {
 *   jobId: string;
 * }
 * 
 * Este endpoint es llamado por un worker/cron para procesar jobs pendientes
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar autorización (solo llamadas internas o con API key)
  const authHeader = req.headers.authorization;
  const apiKey = process.env.INTERNAL_API_KEY;

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let payload: { jobId?: string } = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  if (!payload.jobId) {
    return res.status(400).json({ error: 'Missing jobId' });
  }

  // Obtener el job
  const { data: job, error: jobError } = await supabaseAdmin
    .from('ai_processing_jobs')
    .select('*')
    .eq('id', payload.jobId)
    .single();

  if (jobError || !job) {
    return res.status(404).json({ error: 'Job not found' });
  }

  // Verificar que el job esté pendiente o en estado de reintento
  if (job.status !== 'PENDING' && job.status !== 'FAILED') {
    return res.status(400).json({ error: `Job status is ${job.status}, cannot process` });
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
      const ocrResult = await provider.extractTextFromImage(imageUrl);

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
      const visionResult = await provider.analyzeImage(imageUrl);

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
    const embeddingResult = await provider.generateImageEmbedding(imageUrl);

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
  const embeddingResult = await provider.generateImageEmbedding(imageUrl);

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
