# Backlog de requisitos - Patitas

**Última actualización:** 28 de octubre de 2026  
**Base analizada:** commit `a4c8a9d`, sin archivos locales pendientes.  
**Alcance:** trabajo pendiente, parcial o bloqueado. Lo que ya está terminado aparece solo como línea base, para no duplicar esfuerzo.  
**Uso:** documento de coordinación para dos personas. Los IDs no se renumeran: si se cae una tarea, se marca `Descartado`; si aparece una nueva, se agrega al final.

---

## 1. Cómo usar este documento

1. Elegir una fila con `Responsable = Sin asignar`, empezando por `P0` y luego `P1`.
2. Cambiar el estado a `En curso`, escribir el nombre del responsable y la rama o PR.
3. Al terminar, cumplir el **criterio de aceptación** y la **definición de terminado** de la sección 8.
4. Pasar la fila a `En revisión` cuando haya PR, y a `Hecho` cuando esté mergeada y verificada.
5. Si cambia el alcance, actualizar el requisito y el criterio; no crear una fila nueva para el mismo trabajo.
6. No usar este documento como sustituto de los tests: la evidencia y los criterios son la guía, la CI es la garantía.

---

## 2. Leyenda

### Estados

| Estado | Significado | Qué implica |
| --- | --- | --- |
| `Hecho` | Implementado, mergeado y verificado | No requiere trabajo, salvo regresión |
| `En revisión` | Implementado, pendiente de PR o revisión | No se empieza de cero; revisar y cerrar |
| `En curso` | Alguien está trabajando en ello | Evitar tocarlo sin coordinar |
| `Parcial` | Existe una parte, pero el flujo completo no funciona | Completar, no reescribir |
| `Pendiente` | No existe | Implementar desde cero |
| `Bloqueado` | Depende de algo externo | Resolver el bloqueo antes de estimar |
| `Descartado` | Se decidió no hacerlo | Dejar el motivo escrito |

### Prioridades

| Prioridad | Criterio |
| --- | --- |
| `P0` | Rompe un flujo crítico o deja un riesgo de seguridad o privacidad. Se atiende ya. |
| `P1` | Necesario para un lanzamiento serio. Siguiente en la fila. |
| `P2` | Mejora importante, planificable. |
| `P3` | Opcional o de bajo impacto. |

### Esfuerzo

| Tamaño | Referencia |
| --- | --- |
| `S` | 1 día o menos de una persona con contexto del repo |
| `M` | 2 a 4 días |
| `L` | 5 a 10 días |

### Tipos

- `RF`: requisito funcional, comportamiento visible del sistema.
- `RNF`: requisito no funcional, calidad, seguridad, rendimiento, operación o mantenimiento.

---

## 3. Resumen

| Área | Filas | P0 | P1 | Pendiente | Parcial | Bloqueado |
| --- | --- | --- | --- | --- | --- | --- |
| IA y matching | 12 | 2 | 4 | 3 | 7 | 2 |
| Producto y experiencia | 8 | 0 | 1 | 4 | 4 | 0 |
| Calidad y pruebas | 9 | 1 | 3 | 6 | 3 | 0 |
| Seguridad y privacidad | 3 | 0 | 1 | 0 | 3 | 0 |
| Operación e infraestructura | 6 | 0 | 4 | 3 | 3 | 0 |
| Documentación y mantenimiento | 2 | 0 | 0 | 2 | 0 | 0 |
| **Total** | **40** | **3** | **13** | **18** | **20** | **2** |

`En curso`: 0 filas. `En revisión`: 0 filas. El árbol de trabajo está limpio: los ajustes de UI en tarjetas y detalle ya están mergeados y no se contabilizan como tarea.

---

## 4. Requisitos funcionales pendientes

| ID | Área | Requisito | Estado | Pri. | Esf. | Evidencia | Criterio de aceptación | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RF-01 | IA y matching | Al publicar un caso `LOST` o `FOUND`, calcular candidatos, guardar `ai_matches` y notificar a ambas partes. Hoy los endpoints existen, pero la UI no los invoca. | Parcial | P0 | M | `api/_lib/ai/handlers/calculate-matches.ts`, `api/_lib/ai/handlers/create-match.ts:188-199`, `src/components/ai/process-button.tsx:27`, `src/components/publications/matches-panel.tsx:36-39` | Publicar un caso genera los matches con score mínimo y dos notificaciones; el panel muestra resultados sin pasos manuales. | Sin asignar |
| RF-02 | IA y matching | Disparar la detección de duplicados al publicar o editar, y corregir la ruta del cliente. | Parcial | P1 | M | `src/lib/ai/duplicates.ts:50` apunta a `/api/ai/detect-duplicates`, ruta que ya no existe; `src/components/ai/duplicate-warning.tsx:21` solo lee detecciones; `detectDuplicates()` no se llama desde ningún componente. | Al publicar o editar se ejecuta la detección, el dueño ve el aviso y el moderador ve la cola. La llamada usa `/api/ai?action=detect-duplicates`. | Sin asignar |
| RF-03 | IA y matching | Moderación obligatoria antes de publicar: texto, imágenes y contenido auto-publicado desde fuentes externas. | Parcial | P0 | L | `api/_lib/ai/job-runner.ts:392-421` solo modera título y descripción; `api/_lib/ai/handlers/process-publication.ts:74-77`; riesgo AI-03 en `docs/AUDITORIA_SEGURIDAD.md:607`. | Ninguna publicación pasa a `ACTIVE` sin resultado `SAFE` de texto e imágenes, o queda en cola de revisión. Las ingestas externas nunca se auto-publican sin revisión. | Sin asignar |
| RF-04 | IA y matching | Extracción estructurada de datos desde OCR y visión: teléfono, fecha, ubicación, recompensa, especie, raza y color. | Parcial | P1 | M | `api/_lib/ai/job-runner.ts:437-455` solo cuenta resultados; la tabla `ai_extracted_attributes` ya existe. | Cada atributo se guarda con valor, confianza y fuente; se prueba con al menos 3 carteles reales. | Sin asignar |
| RF-05 | IA y matching | Conectar la UI de sugerencias y resultados de extracción al formulario de publicación. | Parcial | P1 | S | `AISuggestions`, `ExtractionResults` e `ImageAnalyzerButton` existen, pero no se importan en ninguna ruta. | Tras analizar, el dueño ve sugerencias por campo, puede aplicar o descartar y el formulario se actualiza. Funciona con teclado. | Sin asignar |
| RF-06 | IA y matching | Worker o cron que consuma `ai_processing_jobs` con reintentos y dead-letter. | Parcial | P1 | M | `process-publication.ts:10-20` ejecuta los jobs dentro de la petición; `runAIJob` deja jobs en `PENDING` para reintento (`job-runner.ts:84-96`), pero nadie los consume; solo existen los workflows `ci.yml` y `telegram-collector.yml`. | Un job `PENDING` se procesa sin usuario; un fallo reintenta con espera creciente; al agotar `max_retries` queda `FAILED` visible. No quedan jobs zombis. | Sin asignar |
| RF-07 | IA y matching | Búsqueda semántica real con `pgvector`. | Bloqueado | P2 | L | `supabase/migrations/0009_ai_infrastructure.sql:120-158` y `0010_matching_system.sql:114-160` activan columnas e índices solo si la extensión existe; `semanticSearch` está definida y sin uso (`src/lib/config/feature-flags.ts:15`); `findSimilarByText` no se llama. | Con `pgvector` activo, una consulta devuelve resultados por similitud. Sin `pgvector`, degrada a búsqueda textual sin error visible. | Sin asignar |
| RF-08 | IA y matching | Matching visual con embeddings de imágenes. | Pendiente | P2 | L | Se generan embeddings de imagen (`job-runner.ts:335-387`), pero `calculate-matches.ts:115` solo usa score estructurado y no se llama `search_similar_images`. | El score visual aparece en los matches, con umbral configurable y prueba con imágenes similares. | Sin asignar |
| RF-09 | IA y matching | Hash perceptual real para detectar duplicados de imagen. | Parcial | P2 | M | `api/_lib/ai/handlers/detect-duplicates.ts:255-266` compara rutas de storage; `similarImage` siempre es `false` y `sameImageHash` compara el path (`:284-285`). | Se calcula un hash perceptual al subir, se compara por distancia y se detecta una imagen recomprimida. Incluye backfill. | Sin asignar |
| RF-10 | IA y matching | Proveedor OpenAI. | Pendiente | P3 | M | `api/_lib/ai-provider.ts:189` no lo implementa y lanza error. | Seleccionable con `AI_PROVIDER=OPENAI`, con tests sin red y error claro si falta la clave. | Sin asignar |
| RF-11 | IA y matching | OCR local con Tesseract. | Bloqueado | P3 | S | `.env.example:44-58` documenta `TESSERACT`, pero `tesseract.js` no está instalado. | Se instala como dependencia opcional o se retira la opción y se documenta el motivo. | Sin asignar |
| RF-12 | IA y matching | Control de costos y cuotas por proveedor de IA. | Pendiente | P2 | M | Solo hay rate limiting de peticiones (`api/_lib/rate-limit-utils.ts`); no se registran tokens, neuronas ni costo por job. | Cada job registra consumo y costo estimado; un presupuesto diario corta con error claro; el admin ve el gasto. | Sin asignar |
| RF-13 | Producto y experiencia | Notificaciones push web para la PWA. | Pendiente | P2 | M | `public/sw.js` no tiene eventos `push` ni `notificationclick`; no hay `pushManager`; hoy solo existe Realtime dentro de la app. | Suscripción opt-in, VAPID, envío al recibir un match o mensaje y fallback in-app. Probado en Android e iOS. | Sin asignar |
| RF-14 | Producto y experiencia | Notificaciones por correo electrónico. | Pendiente | P2 | M | `package.json:17-35` no incluye proveedor de email; Supabase Auth solo envía correos de autenticación. | Correos de match, adopción y seguridad con proveedor, plantillas, manejo de rebotes y opt-out. | Sin asignar |
| RF-15 | Producto y experiencia | Eliminación de cuenta y exportación de datos personales. | Pendiente | P1 | M | No existen `deleteAccount` ni funciones de exportación en `src/`; el perfil solo permite cambiar avatar. | El usuario solicita borrado, confirma, se anonimiza o elimina y queda auditoría. La exportación entrega JSON o CSV con sus datos. | Sin asignar |
| RF-16 | Producto y experiencia | Edición de perfil y credenciales desde ajustes. | Parcial | P2 | M | `updateProfile()` existe y no se usa (`src/lib/supabase/profiles.ts:252`); el dashboard muestra los datos en modo lectura (`src/routes/dashboard-page.tsx:380-430`); `updatePassword()` solo se usa en el reset. | Se editan nombre, bio, ciudad y username con validación; se cambian contraseña y email con reautenticación. | Sin asignar |
| RF-17 | Producto y experiencia | Preferencias de notificación por tipo y canal. | Parcial | P2 | S | Solo existen alertas por municipio (`src/lib/supabase/alerts.ts:8-20` y migración `0028`); no hay preferencias por `MATCH`, `REPORT` o `MESSAGE`. | El usuario elige tipos y canales; la entrega respeta la preferencia. Desactivar un tipo no borra el historial. | Sin asignar |
| RF-18 | Producto y experiencia | Agrupar marcadores del mapa con clustering. | Parcial | P2 | S | `react-leaflet-cluster` está instalado (`package.json:31`) pero no se usa; `src/routes/map-page.tsx:320` renderiza marcadores individuales. | 500 marcadores se agrupan y se desagrupan al hacer zoom; los filtros siguen funcionando. | Sin asignar |
| RF-19 | Producto y experiencia | Completar o retirar el adaptador de Facebook Público. | Pendiente | P3 | S | `src/lib/adapters/facebook-public-adapter.ts:216` tiene un `TODO` y el flag está apagado por defecto. | Hay parseo real del feed con tests y límites, o se elimina el módulo y se documenta la decisión. | Sin asignar |
| RF-20 | Producto y experiencia | Suspender y reactivar usuarios desde el panel de administración. | Parcial | P2 | S | `src/routes/admin-page.tsx:637-646` solo permite cambiar el rol; `deleted_at` se muestra, pero no se puede modificar. | Suspender impide publicar y mensajear; es reversible, pide motivo y escribe en `audit_logs`. No borra datos. | Sin asignar |

---

## 5. Requisitos no funcionales pendientes

| ID | Área | Requisito | Estado | Pri. | Esf. | Evidencia | Criterio de aceptación | Responsable |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RNF-01 | Calidad y pruebas | Tests E2E de los flujos críticos con Playwright. | Pendiente | P0 | L | No hay dependencia, configuración ni carpeta de E2E; `.github/workflows/ci.yml` solo ejecuta lint, tipos, build, SQL y Vitest. | Registro, publicar, buscar, abrir chat y moderar corren en CI contra un preview. En fallo se guardan trace y video. | Sin asignar |
| RNF-02 | Calidad y pruebas | Tests de integración de los endpoints `/api`. | Parcial | P1 | M | `api/__tests__/` cubre helpers y proveedores; no hay pruebas de request/response ni de autenticación de endpoints. | Cada endpoint tiene casos 200, 400, 401, 403 y 429, sin red real ni servicios externos. | Sin asignar |
| RNF-03 | Calidad y pruebas | Medir cobertura y fijar un umbral. | Pendiente | P2 | S | `vite.config.ts` no tiene configuración de coverage; `package.json` no tiene script de cobertura. | `npm run test:coverage` genera reporte en CI con umbral global del 70% y 80% en `src/lib/`. | Sin asignar |
| RNF-04 | Calidad y pruebas | Extender pgTAP a las migraciones sin suite. | Parcial | P1 | M | `supabase/tests/` tiene 5 suites (`0013`, `0014`, `0019`, `0022`, `0023`); faltan, entre otras, `0015` a `0018`, `0020`, `0021` y `0024` a `0028`. | Cada migración con RLS o trigger tiene suite, y la CI las ejecuta contra Supabase local o un job dedicado. | Sin asignar |
| RNF-05 | Operación e infraestructura | Observabilidad: errores, métricas, trazas y alertas. | Pendiente | P1 | M | Solo hay `console.error`; no hay Sentry ni métricas de producto; `/api/health` existe, pero no hay monitor que avise. | Errores con release y usuario anónimo; métricas de 5xx, latencia y jobs; alerta a un canal y dashboard básico. | Sin asignar |
| RNF-06 | Operación e infraestructura | Imágenes con dimensiones persistidas, `srcset` y miniaturas. | Parcial | P1 | M | `api/uploads.ts:196-202` devuelve `width` y `height`, pero no se guardan en la base; no hay `srcset`; `publication-card.tsx:40` solo usa `loading="lazy"`. | Las dimensiones se guardan al subir, se generan 2 o 3 tamaños y las listas usan `srcset` y `sizes`. CLS menor a 0.1. | Sin asignar |
| RNF-07 | Calidad y pruebas | Auditoría Lighthouse y presupuesto de rendimiento. | Pendiente | P2 | S | No hay Lighthouse CI; `docs/AUDITORIA_SEGURIDAD.md:902` deja la medición como paso manual pendiente. | Lighthouse CI en preview con presupuestos: LCP menor a 2.5 s en móvil, CLS menor a 0.1 e INP menor a 200 ms. | Sin asignar |
| RNF-08 | Calidad y pruebas | Auditoría de accesibilidad WCAG AA. | Parcial | P1 | M | Hay guías y `prefers-reduced-motion`, pero no hay `axe`, `pa11y` ni auditoría manual registrada. | `axe` sin errores críticos en rutas públicas y admin; navegación completa con teclado y lector; contraste AA. | Sin asignar |
| RNF-09 | Calidad y pruebas | Matriz de dispositivos y navegadores. | Pendiente | P2 | M | No hay pruebas de dispositivo ni configuración de BrowserStack u similar. | Checklist probado en iOS Safari, Android Chrome y escritorio; cámara, geolocalización, compartir y PWA incluidos. | Sin asignar |
| RNF-10 | Seguridad y privacidad | Rate limiting verificado en autenticación y flujos de abuso. | Parcial | P2 | S | Hay límites en `/api` y en la base; la autenticación se delega a Supabase; no hay prueba de fuerza bruta ni CAPTCHA. | Se verifican los límites de Supabase, se añade CAPTCHA si hay abuso y hay tests de fuerza bruta y enumeración. | Sin asignar |
| RNF-11 | Operación e infraestructura | Copias de seguridad y restauración probada. | Pendiente | P1 | S | No hay configuración versionada de backups ni prueba de restauración documentada. | Backup diario, retención de 30 días, restauración probada cada trimestre y RPO/RTO escritos. | Sin asignar |
| RNF-12 | Operación e infraestructura | Entorno de staging y migraciones automáticas. | Parcial | P2 | M | La CI valida SQL de forma estática (`npm run validate:sql`), pero no aplica migraciones ni ejecuta smoke tests contra una base real. | Staging con Supabase separado, migraciones automáticas y smoke test después del deploy. | Sin asignar |
| RNF-13 | Documentación y mantenimiento | Documentación viva y contrato de API. | Pendiente | P2 | M | `README.md:696` dice 35% y `README.md:386` dice 12 migraciones, cuando hay 28; `docs/ESTADO_IMPLEMENTACION.md:3` sigue fechado el 6 de octubre; `AGENTS.md` dice 215 tests y hoy pasan 327. | README y estado al día; OpenAPI o contract tests; changelog por release. | Sin asignar |
| RNF-14 | Documentación y mantenimiento | Limpieza de feature flags y código muerto. | Pendiente | P2 | S | `semanticSearch`, `visualMatching` y `realOcr` no tienen consumidor; `AISuggestions`, `ExtractionResults`, `ImageAnalyzerButton`, `createHybridMatch` y `updateProfile` no se usan; hay lógica de matching duplicada entre `src/lib/matching` y la base. | Cada flag tiene consumidor o se elimina; no quedan exports muertos; una sola implementación de matching. | Sin asignar |
| RNF-15 | Operación e infraestructura | Guardia del límite de 12 Functions de Vercel en CI. | Pendiente | P2 | S | Hoy hay 8 endpoints en `api/`; el límite de Hobby está documentado en `AGENTS.md`, pero no hay comprobación automática. | Un script cuenta `api/*.ts` (excluye `_lib`, `_types` y tests) y falla si supera 12. | Sin asignar |
| RNF-16 | Calidad y pruebas | Prueba de carga de búsqueda y listados. | Pendiente | P2 | M | Hay índices FTS y trigram, pero no hay prueba de volumen ni medición de latencia. | Con 10 000 y 100 000 publicaciones, la búsqueda mantiene p95 menor a 500 ms y `EXPLAIN` no muestra `seq scan` evitable. | Sin asignar |
| RNF-17 | Operación e infraestructura | Procesamiento de IA dentro del límite de 60 s de Vercel. | Parcial | P1 | M | `vercel.json:5-9` fija `maxDuration: 60` para `/api/ai`; el job de OCR y visión procesa hasta 5 imágenes en serie (`job-runner.ts:145-191`). | Cinco imágenes con Cloudflare terminan en menos de 50 s o se dividen en jobs. Hay timeout controlado y reintento. | Sin asignar |
| RNF-18 | Seguridad y privacidad | Retención y limpieza de datos. | Parcial | P1 | M | Hay soft delete y auditoría de contacto, pero no hay job de limpieza de imágenes huérfanas, chats archivados ni política técnica de retención. | Política documentada y job que purga soft deletes, objetos huérfanos y chats según plazo. | Sin asignar |
| RNF-19 | Seguridad y privacidad | Cadena de suministro de dependencias. | Parcial | P2 | S | `npm audit` corre en CI, pero no hay Dependabot, CodeQL ni SBOM; las acciones no están fijadas por SHA. | Dependabot o Renovate, CodeQL, SBOM y acciones fijadas por SHA, con revisión de nuevas dependencias. | Sin asignar |
| RNF-20 | Calidad y pruebas | Resiliencia de la UI: error boundaries y reintentos. | Pendiente | P2 | S | No hay `ErrorBoundary` en `src/`; el service worker tiene fallback offline, pero un error de render deja la pantalla en blanco. | Error boundary por ruta, mensaje accionable, botón de reintento y prueba con error simulado. | Sin asignar |

---

## 6. Línea base ya implementada

No rehacer. Esta tabla sirve para que la otra persona no confunda una funcionalidad terminada con una tarea pendiente.

| Área | Qué está hecho | Evidencia |
| --- | --- | --- |
| Autenticación | Email y contraseña, OAuth, callback, recuperación, reset y roles | `src/routes/auth/`, `src/lib/supabase/auth.ts` |
| Publicaciones | CRUD, wizard, tipos `LOST`, `FOUND`, `ADOPTION`, `ABANDONED` y `SIGHTING`, imágenes y cartel con QR | `src/routes/publish-page.tsx`, `src/lib/poster/` |
| Imágenes | Subida solo por `/api/uploads`, EXIF fuera, magic bytes, límite de tamaño y nombre generado en servidor | `api/uploads.ts`, `api/_lib/image-process.ts` |
| Búsqueda | Full text search, filtros avanzados, paginación y finales felices | migración `0008`, `0024`; `src/routes/search-page.tsx` |
| Mapa | Leaflet, filtros, popups y página de cercanía con geolocalización | `src/routes/map-page.tsx`, `src/routes/nearby-page.tsx` |
| Notificaciones | Realtime, badge, marcar leídas, borrar y alertas por municipio | `src/routes/notifications-page.tsx`, `src/lib/supabase/alerts.ts` |
| Chat | Conversaciones 1:1, Realtime, bloqueos, reportes y adjuntar contacto | migración `0019`, `src/lib/supabase/chat.ts` |
| Adopciones | Solicitudes, estados, notas del dueño, notificaciones y panel en dashboard | migración `0017`, `src/components/adoptions/adoption-requests-panel.tsx` |
| Confianza | Verificación de perfiles y reencuentros | migración `0026`, `src/lib/supabase/trust.ts` |
| Administración | 13 pestañas: resumen, métricas, auditoría, reportes, verificaciones, mensajes reportados, duplicados, moderación IA, pendientes, retiradas, fuentes, publicaciones y usuarios | `src/routes/admin-page.tsx:262-275` |
| IA | Proveedores Cloudflare y Google Vision reales, jobs on-demand, OCR, visión, embeddings y moderación de texto | `api/_lib/ai-provider.ts`, `api/_lib/ai/job-runner.ts` |
| Seguridad | RLS, grants por columna, cuota de contacto, rate limit en base y Redis, CSP, validación SQL y tests de secretos | migraciones `0013` a `0016`, `scripts/validate-sql.mjs`, `src/lib/__tests__/secrets.test.ts` |
| SEO y GEO | Open Graph para bots, sitemap, `llms.txt`, JSON-LD y canonical | `api/_lib/seo/`, `public/llms.txt`, `src/lib/seo/page-meta.ts` |
| PWA y rendimiento | Service worker, code splitting por ruta, vendors separados y Leaflet diferido | `public/sw.js`, `src/app/App.tsx:11-28` |
| Pruebas | 30 archivos y 327 tests en verde, más validación de migraciones | `npm test`, `npm run validate:sql` |

---

## 7. Bloqueos y decisiones que no son deuda

### Bloqueos externos

| Bloqueo | Impacto | Acción para desbloquear |
| --- | --- | --- |
| `pgvector` no está activo en Supabase | RF-07 y RF-08 quedan en modo degradado | Activar la extensión y ejecutar el backfill de embeddings |
| Credenciales reales de IA no configuradas por defecto | La UI de IA está apagada con `VITE_AI_ENABLED=false` | Configurar Cloudflare o Google Vision y activar el flag solo con proveedor real |
| Upstash o Vercel KV no configurado en local | El rate limit cae a memoria por instancia | Configurar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` |
| Límite de 12 Functions de Vercel Hobby | No se pueden añadir endpoints nuevos sin consolidar | Reutilizar `api/ai.ts`, `api/admin.ts` y `api/publications.ts` con `?action=` o `?resource=` |
| Proveedor de email y de push sin elegir | RF-13 y RF-14 no se pueden cerrar | Decidir proveedor y variables de entorno |
| Playwright no instalado | RNF-01 no puede empezar | Añadir dependencia y navegadores en CI |
| Acceso a Supabase de producción | RNF-04, RNF-11 y RNF-12 requieren base real | Definir staging y credenciales de solo lectura para pruebas |

### Decisiones que no son deuda

- Las columnas `contact_*` no se leen con `SELECT` directo: es intencional. Solo se obtienen con `reveal_publication_contact()`, con cuota y auditoría.
- La UI de IA está apagada con `AI_PROVIDER=MOCK`: es intencional para no presentar resultados inventados como reales.
- El mapa ya está implementado; lo que falta es el clustering, no la página.
- Leaflet se carga solo al abrir `/mapa`: es una optimización, no una regresión.
- No existen usuarios semilla en las migraciones: es intencional.
- El worker de Telegram se ejecuta con GitHub Actions cada 20 minutos; no necesita una Function de Vercel.
- Hay 8 Functions en `api/`, por debajo del límite de 12. El límite no está en riesgo hoy.

---

## 8. Definición de terminado

Una fila solo pasa a `Hecho` cuando cumple todo esto:

- [ ] `npm run lint` sin warnings.
- [ ] `npm run typecheck` sin errores.
- [ ] `npm test` en verde, con tests nuevos si cambió lógica.
- [ ] `npm run validate:sql` en verde si se tocó SQL.
- [ ] Sin `any` nuevos y comentarios en español.
- [ ] El criterio de aceptación está probado, no solo implementado.
- [ ] Si cambió un contrato de API o de base, la documentación o el tipo se actualizó.
- [ ] Deploy preview revisado en móvil y escritorio.
- [ ] La fila tiene evidencia actualizada y responsable.

---

## 9. Plan sugerido en tres iteraciones

Es una propuesta de orden, no un compromiso de fechas.

### Iteración 1: cerrar el circuito crítico

- RF-01: orquestar matching al publicar.
- RF-02: arreglar la ruta de duplicados y disparar la detección.
- RF-03: moderación obligatoria antes de publicar.
- RNF-01: smoke E2E de registro, publicación y búsqueda.
- RNF-11: backups y restauración.
- RNF-17: presupuesto de tiempo de la IA.

### Iteración 2: calidad de lanzamiento

- RF-04 y RF-05: extracción estructurada y UI de sugerencias.
- RF-06: worker o cron de IA.
- RF-15: borrado de cuenta y exportación.
- RNF-02: integración de endpoints.
- RNF-04: pgTAP de las migraciones restantes.
- RNF-05: observabilidad.
- RNF-06: dimensiones, miniaturas y `srcset`.
- RNF-08: accesibilidad.
- RNF-18: retención y limpieza.

### Iteración 3: escala y extras

- RF-07 y RF-08: semántica y visual, cuando `pgvector` esté activo.
- RF-09: hash perceptual.
- RF-10 a RF-14: proveedores, costos, push y email.
- RF-16 a RF-20: perfil, preferencias, mapa, Facebook y usuarios.
- RNF-03, RNF-07, RNF-09, RNF-10, RNF-12 a RNF-16 y RNF-19 a RNF-20.

---

## 10. Verificaciones manuales pendientes

Estas no se pueden cerrar solo con código y conviene hacerlas antes de un lanzamiento:

1. Confirmar en Supabase que no existen las cuentas semilla `ana@patitas.dev`, `luis@patitas.dev` ni `mod@patitas.dev`, y que no hay moderadores inesperados.
2. Confirmar que el rate limit usa Redis: la cabecera `X-RateLimit-Backend` debe devolver `redis`, no `memory`.
3. Configurar un proveedor de IA real y activar `VITE_AI_ENABLED=true` solo después de verificar que los resultados no son de `MOCK`.
4. Ejecutar Lighthouse contra el deploy y anotar LCP, CLS e INP.
5. Probar una restauración de backup en una base de staging.
6. Revisar el dominio canónico y las Redirect URLs de Supabase antes de publicar.
