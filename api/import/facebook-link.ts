import type { VercelRequest, VercelResponse } from '@vercel/node';
import { supabaseAdmin } from '../_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from '../_lib/rate-limit-utils';
import { facebookLinkImportSchema, extractOpenGraphMetadata, FACEBOOK_IMPORT_CONSTANTS } from '../../src/lib/validations/facebook-import';
import { getAIProvider } from '../_lib/ai-provider';

function json(res: VercelResponse, statusCode: number, body: unknown) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(statusCode).json(body);
}

interface FacebookImportResponse {
  success: boolean;
  data?: {
    title: string | null;
    description: string | null;
    image_url: string | null;
    extracted?: Record<string, unknown>;
    confidence?: number;
  };
  error?: string;
  suggestion?: 'UPLOAD_SCREENSHOT';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
  
  if (req.method !== 'POST') {
    return json(res, 405, { error: 'Method not allowed' });
  }
  
  // Rate limiting: 10 imports por hora por IP
  if (!checkRateLimit(req, res, 'facebook-import-link', 10, 3600_000)) {
    return;
  }
  
  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);
  
  if (authError || !user) {
    return json(res, 401, { error: authError || 'Unauthorized' });
  }
  
  let payload: { url?: string } = {};
  
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return json(res, 400, { error: 'Invalid JSON body' });
  }
  
  const validation = facebookLinkImportSchema.safeParse(payload);
  if (!validation.success) {
    return json(res, 400, { error: 'Validation failed', details: validation.error.flatten() });
  }
  
  const url = validation.data.url;
  
  // Fetch con protección SSRF
  let html: string;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FACEBOOK_IMPORT_CONSTANTS.REQUEST_TIMEOUT_MS);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': FACEBOOK_IMPORT_CONSTANTS.USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      },
      redirect: 'manual', // No seguir redirecciones
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.status >= 300 && response.status < 400) {
      // Redirección - no seguir por seguridad SSRF
      return json(res, 400, { 
        error: 'Redirección detectada. Por seguridad no seguimos redirecciones. Intenta con la URL final o sube una captura.',
        suggestion: 'UPLOAD_SCREENSHOT',
      });
    }
    
    if (!response.ok) {
      return json(res, 400, { 
        error: `No se pudo acceder al enlace (${response.status}). Facebook puede requerir login.`,
        suggestion: 'UPLOAD_SCREENSHOT',
      });
    }
    
    // Verificar content-type
    const contentType = response.headers.get('content-type') ?? '';
    if (!contentType.includes('text/html')) {
      return json(res, 400, { 
        error: 'La URL no devuelve HTML. Puede ser un enlace directo a imagen/video.',
        suggestion: 'UPLOAD_SCREENSHOT',
      });
    }
    
    // Leer con límite de tamaño
    const reader = response.body?.getReader();
    if (!reader) {
      return json(res, 500, { error: 'No se pudo leer la respuesta' });
    }
    
    let receivedSize = 0;
    const chunks: Uint8Array[] = [];
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      chunks.push(value);
      receivedSize += value.length;
      
      if (receivedSize > FACEBOOK_IMPORT_CONSTANTS.MAX_RESPONSE_SIZE) {
        reader.cancel('Response too large');
        return json(res, 400, { error: 'Respuesta demasiado grande' });
      }
    }
    
    const buffer = Buffer.concat(chunks);
    html = buffer.toString('utf-8');
    
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return json(res, 408, { error: 'Timeout accediendo al enlace' });
    }
    console.error('Error fetching Facebook URL:', error);
    return json(res, 500, { error: 'Error accediendo al enlace' });
  }
  
  // Extraer metadatos Open Graph
  const metadata = extractOpenGraphMetadata(html);
  
  // Verificar si tenemos datos mínimos útiles
  const hasUsefulData = metadata.title || metadata.description || metadata.image;
  
  if (!hasUsefulData) {
    return json(res, 200, {
      success: false,
      error: 'No se pudieron extraer datos públicos del enlace. Facebook puede requerir login o el post no tiene metadatos abiertos.',
      suggestion: 'UPLOAD_SCREENSHOT',
    } as FacebookImportResponse);
  }
  
  // Si hay imagen, intentar extraer más datos con IA (opcional)
  let extractedData: Record<string, unknown> | undefined;
  let confidence = 0.5; // Base confidence para metadatos OG
  
  if (metadata.image) {
    try {
      const provider = getAIProvider();
      const visionResult = await provider.analyzeImage(metadata.image, 
        'Analiza esta imagen de una mascota. Extrae: especie, raza, color, tamaño, sexo, collar, placa, características visibles. Responde en JSON.'
      );
      
      if (visionResult.description) {
        // Parsear descripción de vision
        const lowerDesc = visionResult.description.toLowerCase();
        extractedData = {
          vision_description: visionResult.description,
          labels: visionResult.labels,
          objects: visionResult.objects,
        };
        
        // Boost confidence si vision detecta cosas relevantes
        const petKeywords = ['dog', 'cat', 'perro', 'gato', 'pet', 'mascota', 'animal'];
        const hasPetContent = petKeywords.some(kw => lowerDesc.includes(kw));
        if (hasPetContent) confidence = Math.min(0.8, confidence + 0.2);
      }
    } catch (error) {
      console.warn('Error en vision AI para Facebook import:', error);
    }
  }
  
  const response: FacebookImportResponse = {
    success: true,
    data: {
      title: metadata.title,
      description: metadata.description,
      image_url: metadata.image,
      extracted: extractedData,
      confidence,
    },
  };
  
  return json(res, 200, response);
}