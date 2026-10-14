# Configuración de IA Gratuita - Patitas

Esta guía te ayudará a configurar los proveedores de IA **completamente gratuitos** para Patitas.

## Opción 1: Tesseract.js (Recomendado para empezar)

### ✅ Ventajas
- **100% Gratuito** sin límites
- **Sin API keys** necesarias
- Funciona **localmente** en Vercel Functions
- Excelente calidad de OCR
- Soporta español + inglés

### ❌ Limitaciones
- Solo OCR (no Computer Vision)
- Consume más recursos que APIs remotas
- Más lento (~2-4 segundos por imagen)

### 📦 Instalación

```bash
npm install tesseract.js
```

### ⚙️ Configuración

En tu archivo `.env`:

```env
AI_PROVIDER=TESSERACT
```

**¡Eso es todo!** No necesitas configurar nada más.

### 🚀 Uso

El sistema automáticamente usará Tesseract para:
- ✅ Extraer texto de imágenes (OCR)
- ✅ Detectar teléfonos, ubicaciones, fechas
- ✅ Leer información de carteles de mascotas perdidas

Para Computer Vision, embeddings y moderación, necesitarás usar Google Vision o Cloudflare AI.

---

## Opción 2: Google Cloud Vision (Mejor calidad)

### ✅ Ventajas
- **Gratis hasta 1,000 requests/mes**
- Excelente calidad de OCR **y** Computer Vision
- Detección de objetos, colores, etiquetas
- Moderación con SafeSearch
- API muy completa

### ❌ Limitaciones
- Requiere cuenta de Google Cloud
- Límite de 1,000 requests/mes gratis
- Después: $1.50 por 1,000 requests

### 📦 Instalación

```bash
npm install @google-cloud/vision
```

### ⚙️ Configuración (Paso a Paso)

#### 1. Crear Proyecto en Google Cloud

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Crea un nuevo proyecto o selecciona uno existente
3. Anota el **Project ID**

#### 2. Activar Cloud Vision API

1. En el proyecto, ve a **APIs & Services** → **Library**
2. Busca **"Cloud Vision API"**
3. Haz clic en **Enable**

#### 3. Crear Service Account

1. Ve a **IAM & Admin** → **Service Accounts**
2. Haz clic en **Create Service Account**
3. Nombre: `patitas-vision`
4. Rol: **Cloud Vision AI Service Agent** o **Owner** (para pruebas)
5. Haz clic en **Done**

#### 4. Generar Credenciales JSON

1. En la lista de Service Accounts, haz clic en la cuenta que creaste
2. Ve a la pestaña **Keys**
3. Haz clic en **Add Key** → **Create new key**
4. Selecciona **JSON**
5. Descarga el archivo

#### 5. Configurar Variable de Entorno

El archivo JSON descargado tiene esta estructura:

```json
{
  "type": "service_account",
  "project_id": "tu-proyecto-123",
  "private_key_id": "abc123...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "patitas-vision@tu-proyecto.iam.gserviceaccount.com",
  "client_id": "123456789",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/..."
}
```

**Importante:** Debes copiar **todo el contenido** en una sola línea.

En tu archivo `.env` o `.env.local`:

```env
AI_PROVIDER=GOOGLE_VISION
GOOGLE_APPLICATION_CREDENTIALS_JSON='{"type":"service_account","project_id":"tu-proyecto-123",...}'
```

**En Vercel:**

1. Ve a tu proyecto → **Settings** → **Environment Variables**
2. Agrega `AI_PROVIDER` con valor `GOOGLE_VISION`
3. Agrega `GOOGLE_APPLICATION_CREDENTIALS_JSON` y pega el JSON completo (sin espacios)

#### 6. Verificar Configuración

Crea un archivo de prueba `test-google-vision.mjs`:

```javascript
import vision from '@google-cloud/vision';

const credentials = JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON);
const client = new vision.ImageAnnotatorClient({ credentials });

async function test() {
  const [result] = await client.textDetection(
    'https://via.placeholder.com/500x200.png?text=PERDIDO+Perro+Negro'
  );
  console.log('Texto detectado:', result.textAnnotations[0].description);
}

test();
```

Ejecuta:
```bash
node test-google-vision.mjs
```

Si funciona, verás el texto extraído.

### 🚀 Uso

Con Google Vision obtienes:

✅ **OCR avanzado**
- Texto de carteles
- Teléfonos y ubicaciones
- Mejor precisión que Tesseract

✅ **Computer Vision**
- Detección de especies (dog, cat)
- Colores y características visuales
- Objetos (collar, leash, etc.)
- Análisis de imágenes completo

✅ **Moderación**
- SafeSearch para contenido inapropiado
- Detección de spam

### 💰 Monitoreo de Cuota

Para ver cuántos requests has usado:

1. Ve a [Google Cloud Console](https://console.cloud.google.com/)
2. Navega a **APIs & Services** → **Dashboard**
3. Selecciona **Cloud Vision API**
4. Verás el gráfico de uso

---

## Opción 3: Híbrido (Recomendado para Producción)

Combina lo mejor de ambos mundos:

```env
AI_PROVIDER=GOOGLE_VISION
GOOGLE_APPLICATION_CREDENTIALS_JSON='...'
```

### Estrategia Híbrida Inteligente

1. **Google Vision** para los primeros 1,000 requests/mes
2. **Fallback a Tesseract** cuando se agote la cuota
3. **Mock** en desarrollo local

Implementación en `ai-provider.ts`:

```typescript
export function getAIProvider(): IAIProvider {
  const provider = process.env.AI_PROVIDER || 'TESSERACT';
  
  // En producción, intentar Google primero
  if (process.env.NODE_ENV === 'production' && provider === 'GOOGLE_VISION') {
    try {
      return getGoogleVisionProvider();
    } catch (error) {
      console.warn('Google Vision no disponible, usando Tesseract', error);
      return getTesseractProvider();
    }
  }
  
  // Desarrollo: usar Tesseract o Mock
  if (provider === 'TESSERACT') return getTesseractProvider();
  return getMockProvider();
}
```

---

## Comparación de Proveedores Gratuitos

| Característica | Tesseract.js | Google Vision (Free) |
|----------------|--------------|----------------------|
| **Precio** | Gratis ilimitado | Gratis hasta 1K/mes |
| **OCR** | ✅ Excelente | ✅ Excelente+ |
| **Computer Vision** | ❌ No | ✅ Sí |
| **Moderación** | ❌ No | ✅ Sí (SafeSearch) |
| **Embeddings** | ❌ No | ❌ No |
| **Velocidad** | 🟨 2-4s | ✅ 0.5-1s |
| **Setup** | ✅ Sin configuración | 🟨 Requiere Service Account |
| **Límites** | ✅ Ninguno | 🟨 1,000 req/mes |
| **Calidad OCR** | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **Idiomas** | 100+ | 50+ |

---

## Recomendaciones por Escenario

### 🏗️ Desarrollo Local
```env
AI_PROVIDER=MOCK  # Sin instalar nada
```

### 🚀 MVP/Lanzamiento
```env
AI_PROVIDER=TESSERACT  # Gratis ilimitado
```

### 📈 Crecimiento (<1000 usuarios/mes)
```env
AI_PROVIDER=GOOGLE_VISION  # Máxima calidad gratis
```

### 💼 Producción (>1000 usuarios/mes)
```env
AI_PROVIDER=GOOGLE_VISION  # Con monitoreo
# + Implementar cache de resultados
# + Fallback a Tesseract
```

---

## Optimización de Costos

### 1. Cache de Resultados

No reprocesar la misma imagen:

```typescript
// Antes de procesar, verificar cache
const cached = await supabase
  .from('ai_ocr_results')
  .select('extracted_text')
  .eq('image_hash', imageHash)
  .maybeSingle();

if (cached) return cached;
```

### 2. Procesamiento Selectivo

Solo procesar cuando el usuario lo solicite:

```typescript
// En lugar de procesar automáticamente todas las publicaciones
// Agregar botón "Analizar con IA" opcional
```

### 3. Batch Processing

Procesar múltiples imágenes juntas:

```typescript
// Google Vision soporta batch requests
const requests = images.map(img => ({
  image: { source: { imageUri: img.url } },
  features: [{ type: 'TEXT_DETECTION' }],
}));

const [response] = await client.batchAnnotateImages({ requests });
```

### 4. Compresión de Imágenes

Reducir tamaño antes de enviar:

```typescript
import sharp from 'sharp';

const optimized = await sharp(imageBuffer)
  .resize(1200, 1200, { fit: 'inside' })
  .jpeg({ quality: 85 })
  .toBuffer();
```

---

## Troubleshooting

### Tesseract: "Worker failed to load"

Verifica que Tesseract pueda descargar los archivos de idioma:

```typescript
const worker = await Tesseract.createWorker('spa+eng', 1, {
  workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js',
  corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5',
  langPath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tessdata',
});
```

### Google Vision: "Permission denied"

Asegúrate de que la Service Account tenga el rol correcto:

1. Ve a **IAM & Admin** → **IAM**
2. Encuentra tu service account
3. Edita y agrega el rol **Cloud Vision AI Service Agent**

### Google Vision: "API not enabled"

```bash
gcloud services enable vision.googleapis.com --project=tu-proyecto
```

### Vercel: "Module not found: 'tesseract.js'"

Asegúrate de que esté en `dependencies` (no `devDependencies`):

```bash
npm install --save tesseract.js
```

---

## Siguiente Paso: Embeddings

Para embeddings de texto e imagen (búsqueda semántica), necesitarás:

1. **Cloudflare AI** (gratis hasta 10K req/día)
2. **OpenAI** (de pago, pero muy bueno)
3. **Sentence Transformers local** (sin costo, pero requiere GPU)

Ver [IA_SISTEMA_COMPLETO.md](./IA_SISTEMA_COMPLETO.md) para más detalles.

---

## Soporte

Si tienes problemas con la configuración:

1. Verifica los logs en Vercel/Railway
2. Revisa que las variables de entorno estén configuradas
3. Prueba primero con `AI_PROVIDER=MOCK`
4. Contacta al equipo de desarrollo

---

## Recursos Útiles

- [Tesseract.js Docs](https://tesseract.projectnaptha.com/)
- [Google Cloud Vision Docs](https://cloud.google.com/vision/docs)
- [Google Cloud Free Tier](https://cloud.google.com/free)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
