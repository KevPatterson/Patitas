/* eslint-disable @typescript-eslint/triple-slash-reference -- los stubs de las
 * dependencias opcionales de IA deben cargarse también cuando Vercel compila este
 * archivo suelto, sin el tsconfig del proyecto. */
/// <reference path="../_types/ai-dependencies.d.ts" />
/**
 * Capa de abstracción para proveedores de IA
 * Permite cambiar de proveedor sin modificar toda la aplicación
 */

export type AIProvider = 'TESSERACT' | 'GOOGLE_VISION' | 'CLOUDFLARE' | 'OPENAI' | 'MOCK';

export type OCRResult = {
  text: string;
  confidence: number;
  language?: string;
  boundingBoxes?: Array<{
    text: string;
    bbox: [number, number, number, number];
    confidence: number;
  }>;
};

export type VisionResult = {
  labels: Array<{ label: string; confidence: number }>;
  objects?: Array<{
    object: string;
    confidence: number;
    bbox?: [number, number, number, number];
  }>;
  description?: string;
};

/**
 * Tipos locales para los SDK opcionales.
 *
 * `tesseract.js` no está instalado y `@google-cloud/vision` se declara de forma
 * laxa en `api/_types/ai-dependencies.d.ts` (solo se usan cuatro métodos y sus
 * tipos de protobuf chocan con estas formas mínimas). En ambos casos los
 * retornos llegan como `any` y los callbacks de `.map()` serían `implicit any`
 * con `strict`. Estas formas mínimas documentan lo que realmente consumimos.
 */
type TesseractWord = {
  text: string;
  bbox: { x0: number; y0: number; x1: number; y1: number };
  confidence: number;
};

type VisionTextAnnotation = {
  description?: string | null;
  locale?: string | null;
  boundingPoly?: { vertices?: Array<{ x?: number | null; y?: number | null }> } | null;
};

type VisionLabelAnnotation = {
  description?: string | null;
  score?: number | null;
};

type VisionLocalizedObject = {
  name?: string | null;
  score?: number | null;
  boundingPoly?: { normalizedVertices?: Array<{ x?: number | null; y?: number | null }> } | null;
};

/**
 * Error de un proveedor de IA con un mensaje apto para mostrarse al usuario.
 *
 * `message` lleva el detalle técnico y se queda en los logs; `hint` es el texto
 * que puede viajar al cliente. Ninguno de los dos incluye credenciales.
 */
export class AIProviderError extends Error {
  readonly hint: string;
  readonly status: number;

  constructor(message: string, hint: string, status = 502) {
    super(message);
    this.name = 'AIProviderError';
    this.hint = hint;
    this.status = status;
  }
}

/** Respuesta genérica de un modelo de Cloudflare Workers AI. */
type CloudflareAIResponse = {
  result?: {
    /**
     * Suele ser texto, pero el modelo puede devolver el JSON ya parseado como
     * objeto. Se normaliza con `toText` antes de usarlo.
     */
    response?: unknown;
    data?: number[][];
    embedding?: number[];
  };
  success?: boolean;
  errors?: Array<{ message?: string; code?: number }>;
};

export type TextEmbeddingResult = {
  embedding: number[];
  dimension: number;
};

export type ImageEmbeddingResult = {
  embedding: number[];
  dimension: number;
};

export type ModerationResult = {
  classification: 'SAFE' | 'SPAM' | 'FRAUD' | 'OFFENSIVE' | 'INAPPROPRIATE' | 'UNRELATED' | 'UNCERTAIN';
  confidence: number;
  reason?: string;
  categories?: Record<string, number>;
};

/**
 * Imagen ya descargada y validada por el endpoint.
 *
 * Cambio de Fase 1 (hallazgo API-05): antes los proveedores recibían una URL y
 * hacían `fetch(imageUrl)` por su cuenta, así que un atacante podía apuntar a
 * `http://169.254.169.254/` (metadatos de nube) o a servicios internos. Ahora la
 * descarga ocurre UNA vez en el endpoint, con `fetchRemoteImage` (allowlist,
 * bloqueo de IPs privadas, sin redirecciones, con timeout y tamaño máximo), y al
 * proveedor solo le llegan bytes.
 */
export type ImagePayload = {
  /** Contenido de la imagen. */
  bytes: Uint8Array;
  /** Tipo MIME real, deducido de los magic bytes. */
  mimeType: string;
  /** URL de origen, solo para trazabilidad y para APIs que exigen un URI. */
  sourceUrl?: string;
};

/** Codifica los bytes en base64 sin depender del tamaño del búfer. */
export function toBase64(payload: ImagePayload): string {
  return Buffer.from(payload.bytes).toString('base64');
}

/** Data URI listo para las APIs que aceptan contenido inline. */
export function toDataUri(payload: ImagePayload): string {
  return `data:${payload.mimeType};base64,${toBase64(payload)}`;
}

export interface IAIProvider {
  /**
   * Extraer texto de una imagen (OCR)
   */
  extractTextFromImage(image: ImagePayload): Promise<OCRResult>;

  /**
   * Analizar imagen con Computer Vision
   */
  analyzeImage(image: ImagePayload, prompt?: string): Promise<VisionResult>;

  /**
   * Analizar texto (clasificación, extracción de entidades, etc.)
   */
  analyzeText(text: string, prompt?: string): Promise<{ summary?: string; confidence?: number }>;

  /**
   * Generar embedding de texto
   */
  generateTextEmbedding(text: string): Promise<TextEmbeddingResult>;

  /**
   * Generar embedding de imagen
   */
  generateImageEmbedding(image: ImagePayload): Promise<ImageEmbeddingResult>;

  /**
   * Moderar contenido. La imagen es opcional y también llega ya descargada.
   */
  moderateContent(text: string, image?: ImagePayload): Promise<ModerationResult>;
}

/**
 * Obtener proveedor de IA configurado
 */
export function getAIProvider(): IAIProvider {
  const provider = (process.env.AI_PROVIDER || 'MOCK') as AIProvider;

  switch (provider) {
    case 'TESSERACT':
      return getTesseractProvider();
    case 'GOOGLE_VISION':
      return getGoogleVisionProvider();
    case 'CLOUDFLARE':
      return getCloudflareProvider();
    case 'OPENAI':
      throw new Error('OpenAI provider not implemented yet');
    case 'MOCK':
    default:
      return getMockProvider();
  }
}

/**
 * Proveedor mock para testing/desarrollo
 */
function getMockProvider(): IAIProvider {
  return {
    async extractTextFromImage(_image: ImagePayload): Promise<OCRResult> {
      // Simular delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      return {
        text: 'PERDIDO\nPerro raza mestiza\nColor marrón\nTeléfono: 53501234\nRecompensa: $500',
        confidence: 0.85,
        language: 'es',
        boundingBoxes: [
          { text: 'PERDIDO', bbox: [10, 10, 100, 40], confidence: 0.95 },
          { text: 'Perro raza mestiza', bbox: [10, 50, 200, 80], confidence: 0.90 },
          { text: 'Color marrón', bbox: [10, 90, 150, 120], confidence: 0.88 },
          { text: 'Teléfono: 53501234', bbox: [10, 130, 180, 160], confidence: 0.92 },
          { text: 'Recompensa: $500', bbox: [10, 170, 180, 200], confidence: 0.87 },
        ],
      };
    },

    async analyzeImage(_image: ImagePayload, _prompt?: string): Promise<VisionResult> {
      await new Promise((resolve) => setTimeout(resolve, 500));

      return {
        labels: [
          { label: 'dog', confidence: 0.98 },
          { label: 'brown', confidence: 0.92 },
          { label: 'collar', confidence: 0.75 },
          { label: 'outdoor', confidence: 0.85 },
        ],
        objects: [
          { object: 'dog', confidence: 0.97, bbox: [100, 50, 400, 350] },
          { object: 'collar', confidence: 0.68, bbox: [180, 120, 220, 140] },
        ],
        description: 'A brown dog wearing a collar, photographed outdoors',
      };
    },

    async generateTextEmbedding(_text: string): Promise<TextEmbeddingResult> {
      await new Promise((resolve) => setTimeout(resolve, 300));

      // Generar embedding mock de 1536 dimensiones (compatible con OpenAI)
      const embedding = Array.from({ length: 1536 }, () => Math.random() * 2 - 1);

      return {
        embedding,
        dimension: 1536,
      };
    },

    async generateImageEmbedding(_image: ImagePayload): Promise<ImageEmbeddingResult> {
      await new Promise((resolve) => setTimeout(resolve, 400));

      // Generar embedding mock de 512 dimensiones
      const embedding = Array.from({ length: 512 }, () => Math.random() * 2 - 1);

      return {
        embedding,
        dimension: 512,
      };
    },

    async moderateContent(_text: string, _image?: ImagePayload): Promise<ModerationResult> {
      await new Promise((resolve) => setTimeout(resolve, 200));

      return {
        classification: 'SAFE',
        confidence: 0.95,
        categories: {
          spam: 0.02,
          fraud: 0.01,
          offensive: 0.01,
          inappropriate: 0.01,
        },
      };
    },

    async analyzeText(_text: string, _prompt?: string): Promise<{ summary?: string; confidence?: number }> {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return {
        summary: JSON.stringify({
          type: 'LOST',
          confidence: 0.7,
          resolved: false,
        }),
        confidence: 0.7,
      };
    },
  };
}

/**
 * Proveedor de Tesseract.js (OCR gratuito)
 */
function getTesseractProvider(): IAIProvider {
  // Import dinámico para evitar carga innecesaria
  let tesseractModule: typeof import('tesseract.js') | null = null;

  const getTesseract = async () => {
    if (!tesseractModule) {
      tesseractModule = await import('tesseract.js');
    }
    return tesseractModule;
  };

  return {
    async extractTextFromImage(image: ImagePayload): Promise<OCRResult> {
      try {
        const Tesseract = await getTesseract();
        
        const worker = await Tesseract.createWorker('spa+eng', 1, {
          logger: (m: import('tesseract.js').LoggerMessage) => console.log('Tesseract:', m),
        });

        // Se le pasan los bytes ya descargados y validados, nunca una URL.
        const { data } = await worker.recognize(Buffer.from(image.bytes));
        
        await worker.terminate();

        // Mapear a nuestro formato
        const boundingBoxes = data.words?.map((word: TesseractWord) => ({
          text: word.text,
          bbox: [
            word.bbox.x0,
            word.bbox.y0,
            word.bbox.x1,
            word.bbox.y1,
          ] as [number, number, number, number],
          confidence: word.confidence / 100,
        })) || [];

        return {
          text: data.text,
          confidence: data.confidence / 100,
          language: 'es',
          boundingBoxes,
        };
      } catch (error) {
        console.error('Tesseract OCR error:', error);
        throw new Error('OCR failed', { cause: error });
      }
    },

    async analyzeImage(_image: ImagePayload, _prompt?: string): Promise<VisionResult> {
      // Tesseract es solo OCR, no tiene Computer Vision
      // Usar Google Vision si está disponible o retornar resultado básico
      return {
        labels: [],
        description: 'Tesseract no soporta Computer Vision. Use GOOGLE_VISION provider.',
      };
    },

    async generateTextEmbedding(_text: string): Promise<TextEmbeddingResult> {
      throw new Error('Tesseract no soporta embeddings. Use GOOGLE_VISION o CLOUDFLARE provider.');
    },

    async generateImageEmbedding(_image: ImagePayload): Promise<ImageEmbeddingResult> {
      throw new Error('Tesseract no soporta embeddings. Use GOOGLE_VISION o CLOUDFLARE provider.');
    },

    async moderateContent(_text: string, _image?: ImagePayload): Promise<ModerationResult> {
      throw new Error('Tesseract no soporta moderación. Use GOOGLE_VISION o CLOUDFLARE provider.');
    },

    async analyzeText(_text: string, _prompt?: string): Promise<{ summary?: string; confidence?: number }> {
      throw new Error('Tesseract no soporta análisis de texto. Use GOOGLE_VISION o CLOUDFLARE provider.');
    },
  };
}

/**
 * Proveedor de Google Cloud Vision (gratuito hasta 1000 req/mes)
 */
/**
 * Traduce un fallo de Google Vision a un mensaje mostrable.
 *
 * El error más habitual es tener la API sin facturación: Google responde
 * `BILLING_DISABLED` o `PERMISSION_DENIED` y el usuario solo veía "falló".
 */
function googleVisionError(error: unknown): AIProviderError {
  const detail = error instanceof Error ? error.message : String(error);

  if (/billing|BILLING_DISABLED|has not been used|not enabled|PERMISSION_DENIED/i.test(detail)) {
    return new AIProviderError(
      `Google Vision falló: ${detail}`,
      'Google Vision requiere facturación habilitada. Actívala o cambia AI_PROVIDER a CLOUDFLARE.',
      403
    );
  }

  return new AIProviderError(
    `Google Vision falló: ${detail}`,
    'Google Vision no pudo analizar la imagen. Inténtalo de nuevo más tarde.'
  );
}

function getGoogleVisionProvider(): IAIProvider {
  const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
  
  if (!credentials) {
    throw new Error('Missing GOOGLE_APPLICATION_CREDENTIALS_JSON environment variable');
  }

  // Import dinámico
  let visionModule: typeof import('@google-cloud/vision') | null = null;
  let visionClient: InstanceType<typeof import('@google-cloud/vision').ImageAnnotatorClient> | null = null;

  const getVisionClient = async () => {
    if (!visionClient) {
      visionModule = await import('@google-cloud/vision');
      const credentialsObj = JSON.parse(credentials);
      visionClient = new visionModule.ImageAnnotatorClient({
        credentials: credentialsObj,
      });
    }
    return visionClient;
  };

  return {
    async extractTextFromImage(image: ImagePayload): Promise<OCRResult> {
      try {
        const client = await getVisionClient();
        
        // Contenido inline: se evita pasar una URL que Google descargaría por su
        // cuenta (y que permitía SSRF a través suyo).
        const [result] = await client.textDetection({
          image: { content: Buffer.from(image.bytes) },
        });
        const detections = result.textAnnotations;

        if (!detections || detections.length === 0) {
          return {
            text: '',
            confidence: 0,
            language: 'es',
          };
        }

        // El primer elemento contiene todo el texto
        const fullText = detections[0];
        
        // Los demás elementos son palabras individuales con bounding boxes
        const boundingBoxes = detections.slice(1).map((word: VisionTextAnnotation) => {
          const vertices = word.boundingPoly?.vertices || [];
          const bbox: [number, number, number, number] = [
            vertices[0]?.x || 0,
            vertices[0]?.y || 0,
            vertices[2]?.x || 0,
            vertices[2]?.y || 0,
          ];

          return {
            text: word.description || '',
            bbox,
            confidence: 0.9, // Google no provee confidence por palabra en text detection
          };
        });

        return {
          text: fullText.description || '',
          confidence: 0.95,
          language: fullText.locale || 'es',
          boundingBoxes,
        };
      } catch (error) {
        console.error('Google Vision OCR error:', error);
        throw googleVisionError(error);
      }
    },

    async analyzeImage(image: ImagePayload, _prompt?: string): Promise<VisionResult> {
      try {
        const client = await getVisionClient();
        
        // Obtener múltiples tipos de anotaciones
        const [result] = await client.annotateImage({
          image: { content: Buffer.from(image.bytes) },
          features: [
            { type: 'LABEL_DETECTION', maxResults: 20 },
            { type: 'OBJECT_LOCALIZATION', maxResults: 10 },
            { type: 'IMAGE_PROPERTIES' },
          ],
        });

        // Procesar labels
        const labels = (result.labelAnnotations || []).map((label: VisionLabelAnnotation) => ({
          label: label.description || '',
          confidence: label.score || 0,
        }));

        // Procesar objetos
        const objects = (result.localizedObjectAnnotations || []).map((obj: VisionLocalizedObject) => {
          const vertices = obj.boundingPoly?.normalizedVertices || [];
          const bbox: [number, number, number, number] | undefined = vertices.length >= 2
            ? [
                vertices[0]?.x || 0,
                vertices[0]?.y || 0,
                vertices[2]?.x || 0,
                vertices[2]?.y || 0,
              ]
            : undefined;

          return {
            object: obj.name || '',
            confidence: obj.score || 0,
            bbox,
          };
        });

        // Generar descripción a partir de los labels principales
        const topLabels = labels.slice(0, 5).map((l: { label: string }) => l.label).join(', ');
        const description = `Image contains: ${topLabels}`;

        return {
          labels,
          objects,
          description,
        };
      } catch (error) {
        console.error('Google Vision analysis error:', error);
        throw googleVisionError(error);
      }
    },

    async generateTextEmbedding(_text: string): Promise<TextEmbeddingResult> {
      throw new Error('Google Vision no soporta embeddings de texto directamente. Use CLOUDFLARE provider o implemente usando Cloud Natural Language API.');
    },

    async generateImageEmbedding(_image: ImagePayload): Promise<ImageEmbeddingResult> {
      throw new Error('Google Vision no soporta embeddings de imagen directamente. Use CLOUDFLARE provider o implemente usando Vertex AI.');
    },

    async moderateContent(text: string, image?: ImagePayload): Promise<ModerationResult> {
      try {
        const client = await getVisionClient();
        
        // Si hay imagen, usar Safe Search (contenido inline, no una URL).
        if (image) {
          const [result] = await client.safeSearchDetection({
            image: { content: Buffer.from(image.bytes) },
          });
          const safeSearch = result.safeSearchAnnotation;

          if (!safeSearch) {
            return { classification: 'UNCERTAIN', confidence: 0 };
          }

          // Mapear niveles de Google a nuestras clasificaciones
          const likelihood = (value: string | null | undefined) => {
            if (!value) return 0;
            const map: Record<string, number> = {
              'VERY_UNLIKELY': 0,
              'UNLIKELY': 0.2,
              'POSSIBLE': 0.5,
              'LIKELY': 0.8,
              'VERY_LIKELY': 1,
            };
            return map[value] || 0;
          };

          const adult = likelihood(safeSearch.adult);
          const violence = likelihood(safeSearch.violence);
          const spoof = likelihood(safeSearch.spoof);
          const medical = likelihood(safeSearch.medical);

          const maxScore = Math.max(adult, violence, spoof, medical);

          if (maxScore >= 0.8) {
            return {
              classification: 'INAPPROPRIATE',
              confidence: maxScore,
              categories: {
                adult: adult,
                violence: violence,
                spoof: spoof,
                medical: medical,
              },
            };
          } else if (maxScore >= 0.5) {
            return {
              classification: 'UNCERTAIN',
              confidence: 0.5,
              categories: {
                adult: adult,
                violence: violence,
                spoof: spoof,
                medical: medical,
              },
            };
          }
        }

        // Moderación básica del texto (keywords)
        const lowerText = text.toLowerCase();
        const spamKeywords = ['viagra', 'casino', 'lottery', 'winner', 'click here'];
        const hasSpam = spamKeywords.some((keyword) => lowerText.includes(keyword));

        if (hasSpam) {
          return { classification: 'SPAM', confidence: 0.8 };
        }

        return { classification: 'SAFE', confidence: 0.9 };
      } catch (error) {
        console.error('Google Vision moderation error:', error);
        return { classification: 'UNCERTAIN', confidence: 0 };
      }
    },

    async analyzeText(text: string, _prompt?: string): Promise<{ summary?: string; confidence?: number }> {
      // Por ahora, análisis heurístico básico
      const lowerText = text.toLowerCase();
      let type = 'NOT_RELEVANT';
      let confidence = 0.3;

      if (lowerText.includes('perdido') || lowerText.includes('se perdió') || lowerText.includes('busco a mi')) {
        type = 'LOST'; confidence = 0.7;
      } else if (lowerText.includes('encontrado') || lowerText.includes('encontré') || lowerText.includes('hallado')) {
        type = 'FOUND'; confidence = 0.7;
      } else if (lowerText.includes('adopción') || lowerText.includes('adoptar') || lowerText.includes('busca hogar')) {
        type = 'ADOPTION'; confidence = 0.7;
      } else if (lowerText.includes('abandonado') || lowerText.includes('abandono')) {
        type = 'ABANDONED'; confidence = 0.7;
      }

      const resolved = lowerText.includes('ya apareció') || lowerText.includes('ya está en casa') ||
                       lowerText.includes('ya tiene dueño') || lowerText.includes('adoptado') ||
                       (type === 'LOST' && lowerText.includes('encontrado'));

      return {
        summary: JSON.stringify({ type, confidence, resolved }),
        confidence,
      };
    },
  };
}

/**
 * Proveedor de Cloudflare Workers AI.
 *
 * Capa gratuita: 10.000 neuronas al día y no pide tarjeta. Si se agota, las
 * peticiones fallan hasta el reinicio diario; no hay cobro automático.
 *
 * LLaVA 1.5 ya no aparece en la lista de precios de Workers AI, así que el OCR
 * y la visión usan el modelo multimodal de Llama 3.2. Para texto se usa la
 * variante rápida de Llama 3.1, más barata que la 3.0.
 */
const CLOUDFLARE_VISION_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct';
const CLOUDFLARE_TEXT_MODEL = '@cf/meta/llama-3.1-8b-instruct-fp8-fast';
const CLOUDFLARE_TIMEOUT_MS = 45_000;

/**
 * Normaliza una variable de entorno pegada a mano.
 *
 * Al copiar el token desde el panel es fácil arrastrar un salto de línea o las
 * comillas, y entonces el header queda `Bearer "cfut_..."` y Cloudflare
 * responde 401. Se recortan espacios y un par de comillas envolventes.
 */
function cleanEnvValue(value: string | undefined): string | undefined {
  const cleaned = value?.trim().replace(/^(["'])(.*)\1$/, '$2').trim();
  return cleaned || undefined;
}

function getCloudflareProvider(): IAIProvider {
  const accountId = cleanEnvValue(process.env.CLOUDFLARE_ACCOUNT_ID);
  const apiToken = cleanEnvValue(process.env.CLOUDFLARE_API_TOKEN);

  if (!accountId || !apiToken) {
    throw new Error(
      'Missing Cloudflare AI credentials: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required'
    );
  }

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;

  /**
   * Ejecuta un modelo y devuelve su `result`.
   *
   * Workers AI puede responder 200 con `success: false`, así que se comprueban
   * el estado HTTP y la bandera. Los fallos se convierten en `AIProviderError`
   * para que el endpoint pueda mostrar un mensaje útil sin filtrar el detalle
   * técnico (que solo va al log).
   */
  const runModel = async (
    model: string,
    body: Record<string, unknown>
  ): Promise<NonNullable<CloudflareAIResponse['result']>> => {
    let response: Response;

    try {
      response = await fetch(`${baseUrl}/${model}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(CLOUDFLARE_TIMEOUT_MS),
      });
    } catch (error) {
      // `AbortSignal.timeout` lanza TimeoutError; un fallo de red llega como TypeError.
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new AIProviderError(
          `Cloudflare AI (${model}) agotó el tiempo de espera`,
          'El análisis tardó demasiado. Prueba con una foto más pequeña.',
          504
        );
      }

      throw new AIProviderError(
        `Cloudflare AI (${model}) no respondió: ${error instanceof Error ? error.message : String(error)}`,
        'No se pudo contactar con el proveedor de IA. Inténtalo de nuevo más tarde.'
      );
    }

    const raw = await response.text();

    if (!response.ok) {
      throw new AIProviderError(
        `Cloudflare AI (${model}) respondió ${response.status}: ${raw.slice(0, 300)}`,
        cloudflareHint(response.status, raw),
        response.status
      );
    }

    let data: CloudflareAIResponse;
    try {
      data = JSON.parse(raw) as CloudflareAIResponse;
    } catch {
      throw new AIProviderError(
        `Cloudflare AI (${model}) devolvió una respuesta que no es JSON`,
        'El proveedor de IA devolvió una respuesta inválida. Inténtalo de nuevo más tarde.'
      );
    }

    if (data.success === false) {
      const detail = (data.errors ?? [])
        .map((error) => error.message)
        .filter(Boolean)
        .join('; ');
      const status = /licen[cs]e|agree|acceptable use/i.test(detail) ? 403 : 400;

      throw new AIProviderError(
        `Cloudflare AI (${model}) falló: ${detail || 'sin detalle'}`,
        cloudflareHint(status, detail),
        status
      );
    }

    return data.result ?? {};
  };

  /** Workers AI espera la imagen como data URL cuando se usa `messages`. */
  const imageDataUrl = (image: ImagePayload): string =>
    `data:${image.mimeType};base64,${toBase64(image)}`;

  return {
    async extractTextFromImage(image: ImagePayload): Promise<OCRResult> {
      // Los bytes llegan ya descargados y validados por el endpoint: aquí no se
      // hace ningún fetch a una URL controlada por el usuario (hallazgo API-05).
      const result = await runModel(CLOUDFLARE_VISION_MODEL, {
        messages: [
          {
            role: 'system',
            content:
              'Eres un OCR. Devuelve únicamente el texto visible en la imagen, sin comentarios, sin markdown y sin traducir. Si no hay texto, responde con una cadena vacía.',
          },
          {
            role: 'user',
            content:
              'Transcribe literalmente todo el texto de la imagen. Conserva teléfonos, direcciones, fechas, precios y nombres tal como aparecen.',
          },
        ],
        image: imageDataUrl(image),
        max_tokens: 512,
        temperature: 0,
      });

      return {
        text: cleanOcrText(result.response ?? ''),
        confidence: 0.8, // Workers AI no devuelve confianza por palabra
        language: 'es',
      };
    },

    async analyzeImage(image: ImagePayload, prompt?: string): Promise<VisionResult> {
      const analysisPrompt =
        prompt ||
        'Analiza la imagen de una mascota. Devuelve SOLO un JSON válido con las claves: species (dog/cat/other), breed, color, size (small/medium/large), sex (male/female/unknown), age (puppy/young/adult/senior/unknown), collar (true/false), plate (true/false), characteristics (texto breve). Si un dato no se ve, usa null. No inventes.';

      const result = await runModel(CLOUDFLARE_VISION_MODEL, {
        messages: [
          {
            role: 'system',
            content:
              'Analizas fotos de mascotas para una plataforma de adopción. Respondes solo con JSON válido, sin markdown.',
          },
          { role: 'user', content: analysisPrompt },
        ],
        image: imageDataUrl(image),
        max_tokens: 400,
        temperature: 0,
      });

      const description = toText(result.response);

      return {
        labels: parseVisionResponse(description),
        description,
      };
    },

    async generateTextEmbedding(text: string): Promise<TextEmbeddingResult> {
      const result = await runModel('@cf/baai/bge-base-en-v1.5', { text });
      const embedding = result.data?.[0] ?? [];

      return {
        embedding,
        dimension: embedding.length,
      };
    },

    async generateImageEmbedding(image: ImagePayload): Promise<ImageEmbeddingResult> {
      const result = await runModel('@cf/microsoft/resnet-50', {
        image: imageDataUrl(image),
      });
      const embedding = result.embedding ?? [];

      return {
        embedding,
        dimension: embedding.length,
      };
    },

    async moderateContent(text: string, _image?: ImagePayload): Promise<ModerationResult> {
      // Workers AI no tiene un modelo de moderación dedicado: se usa el LLM.
      const result = await runModel(CLOUDFLARE_TEXT_MODEL, {
        messages: [
          {
            role: 'system',
            content:
              'Clasificas contenido para una plataforma de mascotas. Responde con UNA sola palabra.',
          },
          {
            role: 'user',
            content: `¿Este contenido es spam, fraude, ofensivo, inapropiado o seguro? Contenido: "${text}". Responde: SAFE, SPAM, FRAUD, OFFENSIVE, INAPPROPRIATE o UNRELATED.`,
          },
        ],
        max_tokens: 10,
        temperature: 0,
      });

      const classificationText = (toText(result.response).trim() || 'SAFE').toUpperCase();
      const validClassifications = ['SAFE', 'SPAM', 'FRAUD', 'OFFENSIVE', 'INAPPROPRIATE', 'UNRELATED'];
      const classification = validClassifications.includes(classificationText)
        ? (classificationText as ModerationResult['classification'])
        : 'UNCERTAIN';

      return {
        classification,
        confidence: 0.75,
      };
    },

    async analyzeText(text: string, prompt?: string): Promise<{ summary?: string; confidence?: number }> {
      // Usar LLM de Cloudflare para análisis de texto
      const analysisPrompt = prompt || 
        `Clasifica este contenido sobre mascotas en Cuba. Responde SOLO en JSON:
{
  "type": "LOST|FOUND|ADOPTION|ABANDONED|NOT_RELEVANT",
  "confidence": 0.0-1.0,
  "resolved": true|false
}

Contenido: "${text}"`;

      const result = await runModel(CLOUDFLARE_TEXT_MODEL, {
        messages: [
          {
            role: 'system',
            content:
              'Clasificas avisos de mascotas. Respondes solo con JSON válido, sin markdown.',
          },
          { role: 'user', content: analysisPrompt },
        ],
        max_tokens: 256,
        temperature: 0.1,
      });

      const responseText = toText(result.response) || '{}';

      // Intentar parsear JSON de la respuesta
      let parsed: { type?: string; confidence?: number; resolved?: boolean };
      try {
        const jsonMatch = responseText.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : responseText);
      } catch {
        // Fallback heurístico
        const lowerText = text.toLowerCase();
        let type = 'NOT_RELEVANT';
        let confidence = 0.3;
        if (lowerText.includes('perdido') || lowerText.includes('se perdió')) { type = 'LOST'; confidence = 0.7; }
        else if (lowerText.includes('encontrado') || lowerText.includes('encontré')) { type = 'FOUND'; confidence = 0.7; }
        else if (lowerText.includes('adopción') || lowerText.includes('adoptar')) { type = 'ADOPTION'; confidence = 0.7; }
        else if (lowerText.includes('abandonado')) { type = 'ABANDONED'; confidence = 0.7; }
        const resolved = lowerText.includes('ya apareció') || lowerText.includes('ya está en casa');
        parsed = { type, confidence, resolved };
      }

      return {
        summary: JSON.stringify(parsed),
        confidence: parsed.confidence ?? 0.3,
      };
    },
  };
}

/**
 * Traduce un fallo de Workers AI a un mensaje que se puede mostrar al usuario.
 *
 * Se revisa primero el texto porque el modelo devuelve la cuota agotada y la
 * licencia de Meta con estados que no siempre son 429/403.
 */
function cloudflareHint(status: number, detail: string): string {
  if (status === 429 || /neurons|rate limit|quota|too many requests/i.test(detail)) {
    return 'La IA alcanzó su límite gratuito diario. Inténtalo más tarde.';
  }

  if (/licen[cs]e|agree|acceptable use/i.test(detail)) {
    return 'Falta aceptar la licencia de Meta para el modelo de visión. Revisa el paso 3 de .env.example.';
  }

  if (status === 401 || status === 403) {
    return 'Cloudflare rechazó las credenciales. Revisa CLOUDFLARE_ACCOUNT_ID y CLOUDFLARE_API_TOKEN en Vercel.';
  }

  if (status === 404) {
    return 'El modelo de visión no está disponible en esta cuenta de Cloudflare.';
  }

  if (status === 413) {
    return 'La imagen es demasiado grande para el proveedor. Usa una foto más pequeña.';
  }

  if (status >= 500) {
    return 'Cloudflare no pudo procesar la imagen en este momento. Inténtalo de nuevo.';
  }

  return 'Cloudflare rechazó la petición. Revisa la configuración del proveedor.';
}

/**
 * Normaliza la respuesta de un modelo a texto.
 *
 * El modelo puede devolver una cadena, un objeto JSON ya parseado o `null`.
 * Antes se asumía cadena y `value.trim()` lanzaba `TypeError` con los objetos,
 * lo que hacía fallar la visión entera.
 */
function toText(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value == null) return '';

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;

    for (const key of ['text', 'response', 'content', 'description']) {
      if (typeof record[key] === 'string') return record[key];
    }

    try {
      return JSON.stringify(value);
    } catch {
      return '';
    }
  }

  return String(value);
}

/**
 * Limpia la salida del OCR: quita bloques de markdown, prefijos típicos del
 * modelo y detecta las respuestas de "no hay texto".
 */
function cleanOcrText(value: unknown): string {
  const text = toText(value).trim();

  if (!text) return '';

  if (/^(no (se )?(hay|encuentra|visible)|there is no (visible )?text|no text)/i.test(text)) {
    return '';
  }

  return text
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/```$/g, '')
    .replace(
      /^(el texto (visible )?en la imagen es|the text in the image is|texto detectado)\s*:?\s*/i,
      ''
    )
    .trim();
}

/**
 * Parsear la respuesta de visión para extraer etiquetas.
 *
 * El modelo puede devolver el JSON envuelto en ```json ... ``` o directamente
 * como objeto, así que se normaliza a texto y se busca el objeto con una
 * expresión regular. Si no hay JSON válido, se cae a palabras clave.
 */
function parseVisionResponse(description: unknown): Array<{ label: string; confidence: number }> {
  const text = toText(description);
  const labels: Array<{ label: string; confidence: number }> = [];

  const add = (label: unknown, confidence: number) => {
    if (typeof label !== 'string') return;

    const value = label.trim();
    if (!value || /^(null|unknown|none|n\/a|no visible)$/i.test(value)) return;

    if (labels.some((item) => item.label.toLowerCase() === value.toLowerCase())) return;

    labels.push({ label: value, confidence });
  };

  // Intentar parsear como JSON (puede venir dentro de un bloque de markdown).
  const jsonCandidate = text.match(/\{[\s\S]*\}/)?.[0];

  if (jsonCandidate) {
    try {
      const parsed = JSON.parse(jsonCandidate) as Record<string, unknown>;

      add(parsed.species, 0.9);
      add(parsed.breed, 0.85);
      add(parsed.color, 0.9);
      add(parsed.size, 0.8);
      add(parsed.sex, 0.8);
      add(parsed.age, 0.7);
      if (parsed.collar === true) add('collar', 0.8);
      if (parsed.plate === true) add('plate', 0.8);
      add(parsed.characteristics, 0.7);

      return labels;
    } catch {
      // No es JSON válido: se sigue con las palabras clave.
    }
  }

  // Extraer keywords comunes
  const keywords = ['dog', 'cat', 'perro', 'gato', 'brown', 'marrón', 'black', 'negro', 'white', 'blanco', 'collar', 'small', 'medium', 'large'];
  const lowerDesc = text.toLowerCase();

  for (const keyword of keywords) {
    if (lowerDesc.includes(keyword)) {
      labels.push({ label: keyword, confidence: 0.7 });
    }
  }

  return labels;
}
