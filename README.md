# 🐾 Patitas — Ayudemos a que vuelvan a casa

**Plataforma comunitaria para reencontrar mascotas perdidas, reportar encontradas y promover adopciones responsables.**

Patitas centraliza en un único lugar lo que hoy se dispersa en estados de WhatsApp, Instagram y Facebook: información estructurada, buscable, geolocalizada y orientada a resultados reales.

**Contexto inicial:** Cuba (provincias y municipios). La arquitectura permite expandirse a otros países.

---

## 📋 Índice

- [🐾 Patitas — Ayudemos a que vuelvan a casa](#-patitas--ayudemos-a-que-vuelvan-a-casa)
  - [📋 Índice](#-índice)
  - [✨ Características principales](#-características-principales)
    - [� Búsqueda y filtrado](#-búsqueda-y-filtrado)
    - [📍 Geolocalización](#-geolocalización)
    - [🤖 Sistema de IA (infraestructura completa)](#-sistema-de-ia-infraestructura-completa)
    - [📱 PWA y Compartir](#-pwa-y-compartir)
    - [🔔 Notificaciones en tiempo real](#-notificaciones-en-tiempo-real)
    - [👥 Sistema social](#-sistema-social)
    - [🛡️ Seguridad y moderación](#️-seguridad-y-moderación)
  - [🛠 Stack tecnológico](#-stack-tecnológico)
    - [Frontend](#frontend)
    - [Backend](#backend)
    - [Herramientas](#herramientas)
  - [🏗 Arquitectura](#-arquitectura)
    - [Principios](#principios)
  - [🚀 Instalación rápida](#-instalación-rápida)
    - [Requisitos previos](#requisitos-previos)
    - [Pasos](#pasos)
    - [Configuración `.env`](#configuración-env)
  - [💻 Desarrollo local](#-desarrollo-local)
    - [Comandos disponibles](#comandos-disponibles)
    - [Usuarios de prueba (seed local)](#usuarios-de-prueba-seed-local)
  - [📁 Estructura del proyecto](#-estructura-del-proyecto)
  - [🗄 Modelo de datos (resumen)](#-modelo-de-datos-resumen)
    - [Tablas principales](#tablas-principales)
    - [Tablas IA (infraestructura completa)](#tablas-ia-infraestructura-completa)
    - [Características del modelo](#características-del-modelo)
  - [🔐 Seguridad y privacidad](#-seguridad-y-privacidad)
    - [Row Level Security (RLS)](#row-level-security-rls)
    - [Protección de datos sensibles](#protección-de-datos-sensibles)
    - [Rate limiting](#rate-limiting)
    - [Headers de seguridad (Vercel)](#headers-de-seguridad-vercel)
    - [Privacidad de ubicación](#privacidad-de-ubicación)
  - [🎨 Sistema de diseño](#-sistema-de-diseño)
    - [Anime Edition](#anime-edition)
      - [Paleta de colores](#paleta-de-colores)
      - [Tipografía](#tipografía)
      - [Animaciones (11 tipos)](#animaciones-11-tipos)
      - [Componentes destacados](#componentes-destacados)
  - [🌐 Despliegue](#-despliegue)
    - [Vercel (recomendado)](#vercel-recomendado)
    - [Preview deployments](#preview-deployments)
  - [📜 Convenciones](#-convenciones)
    - [Commits (Conventional Commits)](#commits-conventional-commits)
    - [Código](#código)
    - [Accesibilidad](#accesibilidad)
  - [📊 Estado del proyecto](#-estado-del-proyecto)
    - [Progreso general: ~35% completado](#progreso-general-35-completado)
    - [Implementado ✅](#implementado-)
    - [Pendiente ⏳](#pendiente-)
  - [📚 Documentación completa](#-documentación-completa)
    - [Documentos disponibles](#documentos-disponibles)
    - [API Documentation](#api-documentation)
      - [Endpoints disponibles](#endpoints-disponibles)
  - [🤝 Contribuir](#-contribuir)
    - [Workflow](#workflow)
    - [Antes de enviar PR](#antes-de-enviar-pr)
    - [Guías](#guías)
  - [📄 Licencia](#-licencia)
  - [💡 Filosofía del producto](#-filosofía-del-producto)
    - [El flujo ideal](#el-flujo-ideal)
    - [Valores](#valores)
  - [📧 Contacto](#-contacto)
  - [🙏 Agradecimientos](#-agradecimientos)

---

## ✨ Características principales

### � Búsqueda y filtrado
- **Full-text search** optimizado con PostgreSQL (`tsvector` + `pg_trgm`)
- Filtros por tipo (perdida, encontrada, adopción, etc.)
- Filtros geográficos (provincia, municipio)
- Filtros por características (especie, raza, tamaño, sexo, color)
- Búsqueda semántica con IA (en desarrollo)

### 📍 Geolocalización
- **Mapa interactivo** con Leaflet + OpenStreetMap (sin API keys)
- **Privacidad garantizada**: coordenadas difuminadas automáticamente (±500m)
- Visualización de publicaciones por zona
- Ubicación nunca expuesta al cliente (column-level grants)

### 🤖 Sistema de IA (infraestructura completa)
- **Autocompletado inteligente de formulario**: Sube una foto del animal o de un cartel y la IA extrae automáticamente:
  - Características visuales (especie, raza, color, tamaño, edad, collar, placa)
  - Texto visible por OCR (ubicación, fecha, hora, contacto, recompensa) ✨ AMPLIADO
- **Matching híbrido**: Coincidencias por similitud estructurada, semántica y visual
- **OCR**: Extracción de texto de imágenes (carteles, anuncios)
- **Computer Vision**: Análisis de características visuales de mascotas
- **Detección de duplicados**: Evita publicaciones repetidas
- **Moderación automática**: Pre-filtrado de contenido inapropiado
- Procesamiento asíncrono con cola de jobs

### 📱 PWA y Compartir
- **Instalable** como app en dispositivos móviles
- Service Worker para funcionamiento offline básico
- **Compartir** con un clic: WhatsApp, Facebook, Telegram, copiar enlace
- **Web Share API** para compartir nativo en móviles
- Open Graph tags para previews atractivos
- JSON-LD para SEO

### 🔔 Notificaciones en tiempo real
- Alertas de **coincidencias** con publicaciones propias
- Notificaciones de **comentarios** y **avistamientos**
- Actualizaciones de **reportes** y moderación
- Subscripción selectiva con **Supabase Realtime**
- Contador visual en navegación

### 👥 Sistema social
- **Comentarios** en publicaciones
- **Timeline de avistamientos** cronológica
- **Solicitudes de adopción** con estados (pendiente, aceptada, rechazada)
- **Sistema de reportes** comunitario
- **Perfiles públicos** con actividad del usuario
- **Dashboard privado** con estadísticas

### 🛡️ Seguridad y moderación
- **Row Level Security (RLS)** en todas las tablas
- **Column-level grants** para datos sensibles (teléfono, microchip)
- **Rate limiting** en endpoints críticos
- Panel de **moderación** para administradores
- **Logs de auditoría** para trazabilidad
- Protección contra IDOR, escalada de privilegios y abuso

---

## 🛠 Stack tecnológico

### Frontend
| Tecnología | Versión | Uso |
|------------|---------|-----|
| React | 19.1.1 | UI library |
| TypeScript | 5.9.2 | Tipado estático |
| Vite | 7.1.7 | Build tool ultrarrápido |
| React Router | 7.9.1 | Enrutamiento SPA |
| Tailwind CSS | 4.1.14 | Estilos con utilidades |
| React Hook Form | 7.89.0 | Gestión de formularios |
| Zod | 4.6.5 | Validación de schemas |
| Leaflet | 1.9.4 | Mapas interactivos |
| Lucide React | 1.52.0 | Iconografía |

### Backend
| Servicio | Uso |
|----------|-----|
| Supabase PostgreSQL | Base de datos con RLS |
| Supabase Auth | Autenticación (email + OAuth) |
| Supabase Storage | Imágenes (pet-images, avatars) |
| Supabase Realtime | Subscripciones en tiempo real |
| Vercel Functions | Serverless para operaciones privilegiadas |

### Herramientas
- **ESLint** + **Prettier**: Linting y formateo
- **Vitest**: Testing unitario
- **TypeScript strict mode**: Cero tolerancia a `any`

---

## 🏗 Arquitectura

```
┌────────────────────────────────────────────────────────┐
│                    CLIENTE (SPA)                        │
│  React + TypeScript + Tailwind + React Router          │
│  • Comunicación directa con Supabase (protegida por RLS)│
└────────────────────┬───────────────────────────────────┘
                     │ HTTPS
                     ▼
┌────────────────────────────────────────────────────────┐
│                       VERCEL                            │
│  ┌─────────────┐  ┌─────────────────────────────────┐ │
│  │ Static SPA  │  │  Serverless Functions (/api)    │ │
│  │   Hosting   │  │  • Moderación                   │ │
│  └─────────────┘  │  • Rate limiting                │ │
│                   │  • Procesamiento IA             │ │
│                   └─────────────────────────────────┘ │
└────────────────────┬───────────────────────────────────┘
                     │
                     ▼
┌────────────────────────────────────────────────────────┐
│                    SUPABASE                             │
│  ┌──────────────────────────────────────────────────┐  │
│  │ PostgreSQL con RLS activo en TODAS las tablas    │  │
│  │ • 20+ tablas con políticas de seguridad          │  │
│  │ • Full-text search + índices optimizados         │  │
│  │ • Triggers automáticos (fuzzy location)          │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │ Auth + Storage + Realtime                        │  │
│  └──────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────┘
```

### Principios

1. **Cliente → Supabase directo**: El frontend hace CRUD directamente protegido por RLS
2. **Vercel Functions solo para privilegios**: Moderación, auditoría, IA, webhooks
3. **Seguridad en capas**: RLS + validación Zod + rate limiting + headers
4. **Privacidad por diseño**: Fuzzing automático de ubicaciones, grants de columna

---

## 🚀 Instalación rápida

### Requisitos previos
- **Node.js** >= 18.0.0
- **npm** >= 9.0.0
- **Supabase CLI** (opcional): `npm i -g supabase`

### Pasos

```bash
# 1. Clonar repositorio
git clone https://github.com/KevPatterson/Patitas---Plataforma-de-mascotas.git
cd Patitas---Plataforma-de-mascotas

# 2. Instalar dependencias
npm install

# 3. Configurar Supabase (opción A: local con Docker)
supabase init
supabase start
supabase db reset

# 3. Alternativa (opción B: Supabase Cloud)
# - Crear proyecto en supabase.com
# - Ejecutar migraciones desde supabase/migrations/ en SQL Editor
# - Copiar URL y anon key desde Settings > API

# 4. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus credenciales de Supabase

# 5. Iniciar desarrollo
npm run dev
# → http://localhost:5173
```

### Configuración `.env`

```env
# CLIENTE (expuestas al navegador, seguras con RLS)
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
VITE_SITE_URL=http://localhost:5173

# SERVIDOR (Vercel Functions - NUNCA con prefijo VITE_)
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-aqui
```

⚠️ **CRÍTICO**: `SUPABASE_SERVICE_ROLE_KEY` solo en servidor (sin `VITE_`). Bypasea RLS.

---

## 💻 Desarrollo local

### Comandos disponibles

```bash
npm run dev        # Servidor de desarrollo (http://localhost:5173)
npm run build      # tsc -b (app + api + tooling) y bundle de producción
npm run preview    # Preview del build
npm run lint       # Verificar código con ESLint
npm run typecheck  # Solo verificación de tipos (tsc -b)
npm run format     # Formatear código con Prettier
npm test           # Ejecutar tests con Vitest
npm audit          # Vulnerabilidades de dependencias
```

### Usuarios de prueba

> **No existen usuarios semilla.** Las migraciones de `supabase/migrations/`
> **no** crean cuentas: solo definen el esquema y las políticas RLS. Tampoco hay
> `supabase/seed.sql` (ver hallazgo DOC-01 en
> [docs/AUDITORIA_SEGURIDAD.md](./docs/AUDITORIA_SEGURIDAD.md)).
>
> Para probar en local crea tus propias cuentas:
>
> 1. `supabase start` y abre Supabase Studio en http://127.0.0.1:54323
> 2. Authentication → Users → *Add user* (email + contraseña propios)
> 3. Los perfiles se crean solos por el trigger `on_auth_user_created`
> 4. Si necesitas un moderador, cambia el rol a mano:
>    `update public.profiles set role = 'MODERATOR' where username = 'tu_usuario';`
>
> Nunca pongas credenciales de prueba en migraciones: se aplican en producción.

---

## 📁 Estructura del proyecto

```
patitas/
├── api/                      # Vercel Serverless Functions
│   ├── _lib/                 # Utilidades (rate limit, supabase admin, IA)
│   ├── types/vercel.ts       # Tipos mínimos de VercelRequest/VercelResponse
│   ├── admin/moderation.ts   # Moderación (JWT + rol desde profiles)
│   ├── ai.ts                 # Router de IA (?action=...)
│   ├── ai/                   # Handlers de IA (procesados vía api/ai.ts)
│   ├── import/               # Importación desde Facebook
│   ├── ingest/               # Ingesta desde worker de Telegram (HMAC)
│   ├── takedown/             # Solicitudes de retirada
│   ├── publications.ts       # create / validate-upload
│   └── health.ts
│
├── src/
│   ├── app/                  # Configuración App
│   │   ├── App.tsx           # Router principal
│   │   ├── auth-context.ts   # Context autenticación
│   │   └── auth-provider.tsx # Provider autenticación
│   │
│   ├── components/           # Componentes React
│   │   ├── ai/               # Componentes IA (suggestions, matches, status)
│   │   ├── layout/           # Layout (navbar, footer, bottom-nav)
│   │   ├── publications/     # Publicaciones (card, comments, timeline)
│   │   └── ui/               # UI base (button, input, loader, etc.)
│   │
│   ├── lib/                  # Lógica de negocio
│   │   ├── ai/               # Sistema IA (jobs, matching, duplicates)
│   │   ├── config/           # Configuración sitio
│   │   ├── constants/        # Constantes (Cuba, labels)
│   │   ├── matching/         # Lógica matching
│   │   ├── seo/              # Meta tags + JSON-LD
│   │   ├── supabase/         # Clientes y operaciones DB
│   │   ├── utils/            # Utilidades (scroll, responsive, share)
│   │   └── validations/      # Schemas Zod
│   │
│   ├── routes/               # Páginas
│   │   ├── auth/             # Login, register, callback, etc.
│   │   ├── home-page.tsx
│   │   ├── search-page.tsx
│   │   ├── map-page.tsx
│   │   ├── publish-page.tsx
│   │   ├── publication-page.tsx
│   │   ├── profile-page.tsx
│   │   ├── dashboard-page.tsx
│   │   ├── adoptions-page.tsx
│   │   ├── notifications-page.tsx
│   │   ├── how-it-works-page.tsx
│   │   └── admin-page.tsx
│   │
│   ├── styles/globals.css    # Estilos globales + Tailwind
│   ├── types/index.ts        # Tipos TypeScript
│   └── main.tsx              # Entry point
│
├── supabase/
│   ├── migrations/           # 12 migraciones SQL (0001-0010 + dos 0011)
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_storage_policies.sql
│   │   ├── ...
│   │   ├── 0011_external_sources.sql
│   │   └── 0012_fix_resolve_policy.sql
│   └── config.toml
│
├── docs/                     # Documentación
│   ├── AUDITORIA_SEGURIDAD.md
│   ├── ESTADO_IMPLEMENTACION.md
│   ├── PROGRESO_IMPLEMENTACION.md
│   └── REDISENO_FINAL_COMPLETO.md
│
├── .github/workflows/ci.yml  # lint + typecheck + build + test + audit
├── .env.example
├── package.json
├── tsconfig.json             # referencias: app, api, node
├── vite.config.ts
├── tailwind.config.js
└── vercel.json
```

---

## 🗄 Modelo de datos (resumen)

### Tablas principales

- **`profiles`**: Perfiles de usuario (1:1 con `auth.users`)
- **`pets`**: Información de mascotas
- **`publications`**: Publicaciones (LOST, FOUND, ADOPTION, etc.)
- **`publication_images`**: Imágenes de publicaciones (hasta 10)
- **`locations`**: Ubicaciones con fuzzing automático
- **`comments`**: Sistema de comentarios
- **`sightings`**: Timeline de avistamientos
- **`notifications`**: Notificaciones en tiempo real
- **`reports`**: Sistema de reportes comunitarios
- **`adoption_requests`**: Solicitudes de adopción
- **`audit_logs`**: Trazabilidad de acciones críticas

### Tablas IA (infraestructura completa)

- **`ai_processing_jobs`**: Cola de procesamiento asíncrono
- **`ai_matches`**: Coincidencias calculadas
- **`ai_ocr_results`**: Resultados de OCR
- **`ai_vision_results`**: Análisis visual
- **`ai_text_embeddings`**: Embeddings de texto
- **`ai_image_embeddings`**: Embeddings de imágenes
- **`ai_moderation_results`**: Moderación automática
- **`duplicate_detections`**: Detección de duplicados

### Características del modelo

- ✅ **UUIDs** como primary keys
- ✅ **Foreign keys** con `ON DELETE` apropiados
- ✅ **Timestamps**: `created_at`, `updated_at`, `deleted_at` (soft deletes)
- ✅ **Full-text search**: columna `search_tsv` con índice GIN
- ✅ **Índices optimizados** para filtros y ordenamiento
- ✅ **Triggers**: Fuzzing de ubicación, actualización de timestamps
- ✅ **Constraints**: Validación de datos a nivel DB

---

## 🔐 Seguridad y privacidad

### Row Level Security (RLS)

**RLS activo en TODAS las tablas**. Políticas por rol:

| Tabla | Público | Autenticado | Moderador | Admin |
|-------|---------|-------------|-----------|-------|
| profiles | Solo públicas | CRUD propio | SELECT | TODO |
| pets | Con publicación | CRUD propio | SELECT | TODO |
| publications | SELECT ACTIVE | CRUD propio | ocultar/restaurar | DELETE |
| locations | Solo fuzzy | insert/update | - | - |
| reports | - | crear + ver propios | gestionar | gestionar |
| notifications | - | solo propias | - | - |

### Protección de datos sensibles

- **`publications.contact_phone` / `contact_whatsapp` / `contact_email`**: sin
  `SELECT` ni para `anon` ni para `authenticated` (migraciones 0013 y 0014). Se
  obtienen **solo** con `reveal_publication_contact()`, que comprueba quién pide,
  aplica una cuota de **30 revelaciones cada 24 h** y registra cada acceso en
  `contact_reveals` y `audit_logs`. El dueño y los moderadores no consumen cuota.
- **`pets.microchip_private`**: oculto por RLS de fila **y** sin permiso de columna
  para `anon`/`authenticated`.
- **`profiles.phone` y `locations.exact_lat/lng`**: esas columnas no existen.
  Solo hay `locations.approximate_lat/lng`, ya difuminadas, y `locations` solo lo
  puede editar el dueño de la publicación que apunte a esa ubicación.
- **Service role key**: nunca expuesta al cliente (sin prefijo `VITE_`). Un test
  de CI (`src/lib/__tests__/secrets.test.ts`) falla si aparece en `src/`.

### Rate limiting

Hay **dos capas**, porque la arquitectura permite hablar directo con Supabase:

**1. En la base de datos** (migración 0013) — no se puede saltar con la anon key:

| Tabla | Límite normal | Cuenta con < 24 h |
|-------|---------------|-------------------|
| `comments` | 10/hora | 3/hora |
| `publications` | 5/día | 2/día |
| `sightings` | 10/hora | 3/hora |
| `adoption_requests` | 10/día | 3/día |
| `reports` | 3/hora | 1/hora |

El error usa SQLSTATE `53400` con `code: RATE_LIMIT_EXCEEDED` en el detalle, para
que el frontend lo distinga de un fallo genérico.

**2. En `/api`** — cuota por IP **y por usuario**:

- IP real desde `x-real-ip` / `x-vercel-forwarded-for` (headers que Vercel
  controla), **nunca** `x-forwarded-for[0]`.
- Contador compartido en **Upstash Redis / Vercel KV**. Sin esas variables cae a
  memoria por instancia y la respuesta lo delata con
  `X-RateLimit-Backend: memory`.
- Los endpoints de IA comparten un único cubo por usuario, así que no se puede
  multiplicar la cuota rotando entre acciones.
- `429` con `Retry-After` y cabeceras `X-RateLimit-*`.

### Headers de seguridad (Vercel)

```json
{
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=(self)"
}
```

Pendiente (Fase 4): migrar `routes` → `rewrites`, añadir CSP, HSTS y COOP.

### Privacidad de ubicación

1. Usuario ingresa ubicación (provincia, municipio, coordenadas opcionales)
2. La entrada se redondea a una rejilla de ~1,1 km y se le aplica un
   desplazamiento de ±0,003° (~330 m)
3. El cliente nunca recibe la coordenada exacta (no se almacena)
4. Mapa muestra ubicación aproximada

El desplazamiento es **determinista**: se deriva de un secreto de servidor
(`public.app_secret()`, guardado en la configuración de la BD y no accesible por
PostgREST) y del id de la fila. Consecuencia práctica: guardar la misma ubicación
50 veces devuelve **siempre el mismo punto**, así que ya no se puede promediar el
ruido para recuperar la posición real. Volver a guardar una ubicación distinta
(otra celda de la rejilla) sí produce otro desplazamiento.

---

## 🎨 Sistema de diseño

### Anime Edition

Identidad visual única inspirada en anime moderno con personalidad y cercanía.

#### Paleta de colores (Monocromática Naranja)

```css
/* Escala naranja principal */
--color-orange-50:  #fff4ea  /* Fondos, reemplaza cream */
--color-orange-100: #ffe6d1  /* Superficies suaves, chips, hover nav */
--color-orange-200: #ffcfa8  /* Reemplaza turquoise: comunidad/decorativos */
--color-orange-300: #ffb078  /* Bordes, acentos suaves */
--color-orange-400: #ff8c42  /* PRINCIPAL: CTAs, activos */
--color-orange-500: #f0721f  /* Hover */
--color-orange-600: #d45a0f  /* Sombras sólidas botones, pressed */
--color-orange-700: #a8440a  /* Texto de acento, links */
--color-orange-900: #3d1d0b  /* Reemplaza navy: texto principal y estructura */

/* Alias compatibilidad */
--color-navy:      #3d1d0b
--color-cream:     #fff4ea
--color-orange:    #ff8c42
--color-turquoise: #ffcfa8

/* Colores semánticos (NO cambian) */
--color-purple:    #a78bfa  /* Adopción */
--color-lost:      #ef4444  /* Urgente, perdidos */
--color-found:     #10b981  /* Resuelto, encontrados */

/* Superficies y texto específicos */
--color-surface-card: #fffaf5
--color-border-card:  #ffd9bb
--color-text-secondary: #8a5a3c
```

#### Tipografía

- **Display**: Baloo 2 (redondeada, amigable, títulos)
- **Sans**: Figtree (moderna, legible, cuerpo)

#### Animaciones (11 tipos)

- `paw-bounce`: Huellas rebotando (identidad de marca)
- `float`: Flotación suave decorativa
- `paw-pulse`: Pulso de huella en loaders
- `shake`: Sacudida para errores
- `fade-up`, `scale-in`, `slide-up`: Scroll reveals
- `glow`: Efecto brillo pulsante
- `blob-morph`: Decoraciones orgánicas

#### Componentes destacados

- **PawLoader**: Loader con huella animada (3 tamaños)
- **PublicationCard**: Card con hover effects, gradientes y microinteracciones
- **Button**: 5 variantes (primary, secondary, adoption, ghost, danger)
- **ScrollReveal**: Componente para animaciones de scroll
- **EmptyState**: Estados vacíos con personalidad y mascotas

Ver documentación completa en [docs/REDISENO_FINAL_COMPLETO.md](./docs/REDISENO_FINAL_COMPLETO.md)

---

## 🌐 Despliegue

### Vercel (recomendado)

1. **Push a GitHub**

2. **Importar en Vercel**
   - Framework preset: Vite (auto-detectado)
   - Build command: `npm run build`
   - Output directory: `dist`

3. **Configurar variables de entorno** en Vercel:
   ```
   SUPABASE_URL
   SUPABASE_SERVICE_ROLE_KEY
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
   VITE_SITE_URL=https://patitass.vercel.app
   ```

4. **Configurar Supabase Auth** (Dashboard → Authentication → URL Configuration):
   - **Site URL**: `https://patitass.vercel.app`
   - **Redirect URLs** (una por línea, **sin comodines**):
     ```
     https://patitass.vercel.app/auth/callback
     https://patitass.vercel.app/auth/reset-password
     http://localhost:5173/auth/callback
     http://localhost:5173/auth/reset-password
     ```
   - Los previews de Vercel (`*-git-*.vercel.app`) **no** se añaden: si necesitas
     probar el login en un preview, añade esa URL exacta de forma temporal y
     quítala después.

> ⚠️ **Un solo dominio canónico.** El proyecto se sirvió en algún momento desde
> `patitas-plataforma-de-mascotas.vercel.app` y desde `patitass.vercel.app`. Usa
> **`patitass.vercel.app`** y desactiva (o borra) el otro proyecto de Vercel: dos
> dominios sirviendo la misma app duplican el contenido para los buscadores y
> rompen el `redirect_to` de OAuth, que solo puede apuntar a las URLs declaradas
> en Supabase.

5. **Deploy automático** en cada push a `main`

### Preview deployments

Vercel crea automáticamente preview deployments por cada PR.

---

## 📜 Convenciones

### Commits (Conventional Commits)

```bash
feat(auth): agregada recuperación de contraseña
fix(rls): corregidas políticas de publications
docs(readme): actualizada documentación de API
refactor(matching): optimizado cálculo de scores
chore(deps): actualizado React a v19
```

**Reglas:**
- ✅ Siempre en español
- ✅ Tipos: `feat`, `fix`, `docs`, `refactor`, `chore`, `test`, `style`
- ✅ Máximo 72 caracteres en el subject
- ✅ Modo imperativo participio: "Agregada validación" (no "Se agregó")

### Código

- ✅ **TypeScript strict** sin `any`
- ✅ **ESLint + Prettier**: Código consistente
- ✅ **Comentarios en español**
- ✅ **Componentes**: PascalCase (`PublicationCard.tsx`)
- ✅ **Utilidades**: camelCase (`slugify.ts`)
- ✅ **Constantes**: UPPER_SNAKE_CASE (`SITE_NAME`)

### Accesibilidad

- ✅ HTML semántico (`<nav>`, `<main>`, `<article>`)
- ✅ `aria-label` en elementos interactivos sin texto
- ✅ `alt` text descriptivo en imágenes
- ✅ Focus visible (outline naranja)
- ✅ Contraste WCAG AA mínimo
- ✅ Touch targets 44px (WCAG AAA)

---

## 📊 Estado del proyecto

### Progreso general: ~35% completado

| Área | Estado | Notas |
|------|--------|-------|
| **Autenticación** | ✅ 100% | Email, OAuth, recuperación |
| **Perfiles** | ✅ 100% | Públicos, dashboard, avatares |
| **Publicaciones** | ✅ 90% | CRUD, wizard, imágenes |
| **Búsqueda** | ✅ 85% | Full-text, filtros, paginación |
| **Mapa** | 🟨 60% | Estructura lista, falta integración |
| **Notificaciones** | ✅ 100% | Real-time, subscripciones |
| **Coincidencias (IA)** | 🟨 70% | Infraestructura completa, falta IA real |
| **Moderación** | 🟨 40% | Reportes funcionando, panel básico |
| **Adopciones** | 🟨 50% | Solicitudes OK, falta panel completo |
| **Testing** | 🟥 10% | Configuración lista, faltan tests |
| **Seguridad** | ✅ 100% | RLS, rate limiting, headers |
| **Design System** | ✅ 100% | Anime Edition completo |

### Implementado ✅

- ✅ Base de datos con 20+ tablas y RLS completo
- ✅ Sistema de autenticación (email + OAuth ready)
- ✅ CRUD completo de publicaciones con wizard
- ✅ Búsqueda avanzada con full-text search
- ✅ Sistema de notificaciones en tiempo real
- ✅ Infraestructura completa de IA (jobs, matching, OCR, vision)
- ✅ Detección de duplicados
- ✅ Rate limiting en endpoints críticos
- ✅ Privacidad de ubicación con fuzzing
- ✅ Sistema de comentarios y avistamientos
- ✅ PWA con service worker
- ✅ Compartir en redes sociales
- ✅ SEO con meta tags y JSON-LD
- ✅ Design System Anime Edition completo
- ✅ Responsive design (320px - 4K+)
- ✅ Animaciones avanzadas de scroll

### Pendiente ⏳

- ⏳ Proveedores de IA reales (OpenAI, Cloudflare AI)
- ⏳ Workers para procesamiento asíncrono
- ⏳ Búsqueda semántica con embeddings
- ⏳ Matching visual con Computer Vision
- ⏳ OCR real para extracción de texto
- ⏳ Panel de moderación completo
- ⏳ Dashboard de adopciones completo
- ⏳ Mapa interactivo funcional
- ⏳ Testing (unitario, integración, E2E)
- ⏳ Observabilidad y métricas

Ver estado detallado en [docs/ESTADO_IMPLEMENTACION.md](./docs/ESTADO_IMPLEMENTACION.md)

---

## 📚 Documentación completa

### Documentos disponibles

- **[ESTADO_IMPLEMENTACION.md](./docs/ESTADO_IMPLEMENTACION.md)**: Estado actual detallado por fase
- **[PROGRESO_IMPLEMENTACION.md](./docs/PROGRESO_IMPLEMENTACION.md)**: Progreso de desarrollo por sesión
- **[REDISENO_FINAL_COMPLETO.md](./docs/REDISENO_FINAL_COMPLETO.md)**: Documentación completa del Design System Anime Edition
- **[ANALISIS_PATITAS.md](./docs/ANALISIS_PATITAS.md)**: Análisis inicial del proyecto

### API Documentation

#### Endpoints disponibles

Los listados aquí son los que existen hoy en `api/`. Todos reciben **POST** salvo
el health check, y todos exigen `Authorization: Bearer <jwt>` salvo donde se
indica.

| Endpoint | Auth | Descripción |
|----------|------|-------------|
| `GET /api/health` | pública | Health check (BD, storage y proveedor IA) |
| `POST /api/publications?action=create` | JWT | Alta de publicación con rate limit |
| `POST /api/publications?action=validate-upload` | JWT | Valida tipo/tamaño/cantidad antes de subir a Storage |
| `POST /api/admin/moderation` | JWT + rol MODERATOR/ADMIN | Acciones de moderación; escribe en `audit_logs` |
| `POST /api/ai?action=<action>` | JWT | Router de IA (`process-publication`, `calculate-matches`, `create-match`, `detect-duplicates`, `extract-from-image`, `process-job`) |
| `POST /api/import/facebook-link` | JWT | Importa metadatos OG de un enlace público de Facebook |
| `POST /api/import/facebook-screenshot` | JWT | Importa datos desde una captura de pantalla |
| `POST /api/ingest/external-post` | HMAC | Ingesta desde el worker de Telegram (`INGEST_HMAC_SECRET`) |
| `POST /api/takedown` | opcional | Solicitud de retirada de contenido (COPYRIGHT, PRIVACY, INACCURATE, OTHER) |

> ⚠️ Varios de estos endpoints todavía tienen validación incompleta (sin Zod,
> sin comprobación de propiedad del recurso) y su rate limiting es por IP en
> memoria. **No confíes solo en `/api` para la autorización**: la Fase 2 del plan
> mueve esas garantías a la base de datos. Ver
> [docs/AUDITORIA_SEGURIDAD.md](./docs/AUDITORIA_SEGURIDAD.md).

---

## 🤝 Contribuir

### Workflow

1. **Fork** el repositorio
2. **Crea una rama** para tu feature: `git checkout -b feat/nueva-funcionalidad`
3. **Commit** tus cambios: `git commit -m "feat(scope): descripción"`
4. **Push** a la rama: `git push origin feat/nueva-funcionalidad`
5. **Abre un Pull Request** describiendo los cambios

### Antes de enviar PR

```bash
# Verificar código
npm run lint

# Formatear
npm run format

# Ejecutar tests
npm run test

# Build exitoso
npm run build
```

### Guías

- Sigue las [convenciones de commits](#-convenciones)
- Mantén TypeScript strict (sin `any`)
- Agrega tests para nuevas funcionalidades
- Documenta cambios significativos
- Respeta el Design System existente

---

## 📄 Licencia

Este proyecto está bajo licencia **MIT**. Ver archivo `LICENSE` para más detalles.

---

## 💡 Filosofía del producto

**Patitas no es "otro sitio de anuncios"**: es el lugar donde buscas cuando una mascota desaparece.

### El flujo ideal

1. **Perdí** mi mascota → Publico con fotos y ubicación
2. **Busco** publicaciones similares → Filtro por zona y características
3. **Reviso el mapa** → Veo avistamientos cercanos
4. **IA encuentra coincidencias** → Recibo notificación de posible match
5. **Contacto** con quien la vio → Coordinamos recuperación
6. **Marco como resuelto** → ¡Celebración! 🎉

### Valores

- **Privacidad primero**: Ubicaciones difuminadas, datos sensibles protegidos
- **Comunidad activa**: Comentarios, avistamientos, ayuda mutua
- **Tecnología al servicio**: IA que ayuda, no reemplaza
- **Accesibilidad universal**: Funciona para todos, en cualquier dispositivo
- **Transparencia**: Código auditable, políticas claras

---

## 📧 Contacto

- **Issues**: [GitHub Issues](https://github.com/KevPatterson/Patitas---Plataforma-de-mascotas/issues)
- **Discussions**: [GitHub Discussions](https://github.com/KevPatterson/Patitas---Plataforma-de-mascotas/discussions)
- **Email**: kevinpatterson618@gmail.com

---

## 🙏 Agradecimientos

- **Supabase** por la infraestructura backend
- **Vercel** por el hosting y serverless functions
- **OpenStreetMap** por los mapas gratuitos
- Comunidad de código abierto por las librerías utilizadas

---

<div align="center">

**🐾 Cada patita merece volver a casa 🐾**

Hecho con ❤️ para las mascotas y las personas que las aman

[⬆ Volver arriba](#-patitas--ayudemos-a-que-vuelvan-a-casa)

</div>