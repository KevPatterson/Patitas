/* eslint-disable @typescript-eslint/triple-slash-reference -- los stubs de las
 * dependencias opcionales de IA deben cargarse también cuando Vercel compila este
 * archivo suelto, sin el tsconfig del proyecto. */
/// <reference path="../types/ai-dependencies.d.ts" />
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
 * `tesseract.js` y `@google-cloud/vision` no están instalados (ver
 * api/types/ai-dependencies.d.ts), así que sus retornos llegan como `any` y los
 * callbacks de `.map()` serían `implicit any` con `strict`. Estas formas
 * mínimas documentan lo que realmente consumimos.
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

/** Respuesta genérica de un modelo de Cloudflare Workers AI. */
type CloudflareAIResponse = {
  result?: {
    response?: string;
    data?: number[][];
    embedding?: number[];
  };
  errors?: Array<{ message?: string }>;
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
        throw new Error('OCR failed');
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
        throw new Error('OCR failed');
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
        throw new Error('Vision analysis failed');
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
 * Proveedor de Cloudflare AI
 */
function getCloudflareProvider(): IAIProvider {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const apiToken = process.env.CLOUDFLARE_API_TOKEN;

  if (!accountId || !apiToken) {
    throw new Error('Missing Cloudflare AI credentials: CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN required');
  }

  const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run`;

  return {
    async extractTextFromImage(image: ImagePayload): Promise<OCRResult> {
      // Los bytes llegan ya descargados y validados por el endpoint: aquí no se
      // hace ningún fetch a una URL controlada por el usuario (hallazgo API-05).
      const imageBase64 = toBase64(image);

      // Cloudflare AI no tiene OCR directo, usar vision model
      const response = await fetch(`${baseUrl}/@cf/llava-hf/llava-1.5-7b-hf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
          prompt: 'Extract all visible text from this image. Include phone numbers, addresses, dates, and any other text you can see. Format as plain text.',
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI OCR failed: ${response.statusText}`);
      }

      const data = (await response.json()) as CloudflareAIResponse;
      const extractedText = data.result?.response || '';

      return {
        text: extractedText,
        confidence: 0.8, // Cloudflare no provee confidence para OCR
        language: 'es',
      };
    },

    async analyzeImage(image: ImagePayload, prompt?: string): Promise<VisionResult> {
      const imageBase64 = toBase64(image);

      const analysisPrompt = prompt || 
        'Analyze this image of a pet. Identify: species (dog/cat/other), breed if visible, color, size (small/medium/large), age estimation, visible features (collar, tags, distinctive marks). Respond in JSON format with keys: species, breed, color, size, age, features.';

      const response = await fetch(`${baseUrl}/@cf/llava-hf/llava-1.5-7b-hf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
          prompt: analysisPrompt,
          max_tokens: 512,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI vision failed: ${response.statusText}`);
      }

      const data = (await response.json()) as CloudflareAIResponse;
      const description = data.result?.response || '';

      // Parsear la respuesta para extraer labels
      const labels = parseVisionResponse(description);

      return {
        labels,
        description,
      };
    },

    async generateTextEmbedding(text: string): Promise<TextEmbeddingResult> {
      const response = await fetch(`${baseUrl}/@cf/baai/bge-base-en-v1.5`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI embedding failed: ${response.statusText}`);
      }

      const data = (await response.json()) as CloudflareAIResponse;
      const embedding = data.result?.data?.[0] || [];

      return {
        embedding,
        dimension: embedding.length,
      };
    },

    async generateImageEmbedding(image: ImagePayload): Promise<ImageEmbeddingResult> {
      const imageBase64 = toBase64(image);

      const response = await fetch(`${baseUrl}/@cf/microsoft/resnet-50`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          image: imageBase64,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI image embedding failed: ${response.statusText}`);
      }

      const data = (await response.json()) as CloudflareAIResponse;
      const embedding = data.result?.embedding || [];

      return {
        embedding,
        dimension: embedding.length,
      };
    },

    async moderateContent(text: string, _image?: ImagePayload): Promise<ModerationResult> {
      // Cloudflare no tiene modelo de moderación específico, usar LLM
      const response = await fetch(`${baseUrl}/@cf/meta/llama-3-8b-instruct`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `Analyze this content for moderation. Is it: spam, fraud, offensive, inappropriate, or safe? Content: "${text}". Respond with ONE word: SAFE, SPAM, FRAUD, OFFENSIVE, INAPPROPRIATE, or UNRELATED.`,
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI moderation failed: ${response.statusText}`);
      }

      const data = (await response.json()) as CloudflareAIResponse;
      const result = (data.result?.response || 'SAFE').trim().toUpperCase();

      const validClassifications = ['SAFE', 'SPAM', 'FRAUD', 'OFFENSIVE', 'INAPPROPRIATE', 'UNRELATED'];
      const classification = validClassifications.includes(result) 
        ? result as ModerationResult['classification']
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

      const response = await fetch(`${baseUrl}/@cf/meta/llama-3-8b-instruct`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: analysisPrompt,
          max_tokens: 256,
          temperature: 0.1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Cloudflare AI text analysis failed: ${response.statusText}`);
      }

      const data = (await response.json()) as CloudflareAIResponse;
      const result = data.result?.response || '{}';

      // Intentar parsear JSON de la respuesta
      let parsed: { type?: string; confidence?: number; resolved?: boolean };
      try {
        const jsonMatch = result.match(/\{[\s\S]*\}/);
        parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
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
 * Parsear respuesta de vision para extraer labels
 */
function parseVisionResponse(description: string): Array<{ label: string; confidence: number }> {
  const labels: Array<{ label: string; confidence: number }> = [];

  // Intentar parsear como JSON
  try {
    const parsed = JSON.parse(description);
    if (parsed.species) labels.push({ label: parsed.species, confidence: 0.9 });
    if (parsed.breed) labels.push({ label: parsed.breed, confidence: 0.85 });
    if (parsed.color) labels.push({ label: parsed.color, confidence: 0.9 });
    if (parsed.size) labels.push({ label: parsed.size, confidence: 0.8 });
    return labels;
  } catch {
    // No es JSON, extraer keywords
  }

  // Extraer keywords comunes
  const keywords = ['dog', 'cat', 'perro', 'gato', 'brown', 'marrón', 'black', 'negro', 'white', 'blanco', 'collar', 'small', 'medium', 'large'];
  const lowerDesc = description.toLowerCase();

  for (const keyword of keywords) {
    if (lowerDesc.includes(keyword)) {
      labels.push({ label: keyword, confidence: 0.7 });
    }
  }

  return labels;
}
