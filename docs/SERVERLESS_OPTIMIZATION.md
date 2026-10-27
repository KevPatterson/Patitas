# Optimización de Serverless Functions

## Resumen

Las serverless functions han sido consolidadas para mantenerse dentro del límite
de 12 funciones del plan Hobby de Vercel. Cada router agrupa endpoints del mismo
dominio y la lógica vive en `api/_lib/`, una ruta que Vercel ignora por el
prefijo `_`.

## Estado Actual

**Total de funciones desplegadas: 8**

### Funciones Activas

1. **`/api/ai`** - Router de IA (`?action=`): `calculate-matches`, `create-match`,
   `detect-duplicates`, `extract-from-image`, `process-publication`, `process-job`.

2. **`/api/publications`** - Router de publicaciones (`?action=`): `create`,
   `validate-upload`, `takedown`.

3. **`/api/uploads`** - Subida de imágenes (`?action=`): `publication-image`,
   `avatar`, `delete-image`.

4. **`/api/admin`** - Router de administración (`?resource=`): `moderation`,
   `verifications`.

5. **`/api/seo`** - Respuestas para buscadores (`?action=`): `og`, `sitemap`.

6. **`/api/import`** - Importación desde Facebook (`?action=`): `link`,
   `screenshot`.

7. **`/api/ingest/external-post`** - Ingesta desde el worker de Telegram (HMAC).

8. **`/api/health`** - Health check.

## Estructura

```
api/
├── ai.ts                         router de IA
├── publications.ts               router de publicaciones y retirada
├── uploads.ts                    subida de imágenes
├── admin.ts                      router de administración
├── seo.ts                        router de SEO (og y sitemap)
├── import.ts                     router de importación de Facebook
├── health.ts                     health check
├── ingest/
│   └── external-post.ts          ingesta HMAC del worker
├── _lib/                         handlers y utilidades compartidas
└── _types/                       tipos mínimos de Vercel
```

## Estrategia de Consolidación

### 1. Router Pattern

En lugar de una función por endpoint, cada dominio tiene un router que despacha
por query parameter:

```typescript
// api/seo.ts
export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = Array.isArray(req.query.action) ? req.query.action[0] : req.query.action;

  switch (action) {
    case 'og':
      return handleOg(req, res);
    case 'sitemap':
      return handleSitemap(req, res);
    default:
      return res.status(400).json({ error: 'Acción desconocida', code: 'INVALID_INPUT' });
  }
}
```

### 2. Handlers en `_lib`

Los handlers específicos viven en `api/_lib/<dominio>/`. Vercel no los despliega
como funciones independientes, pero se incluyen en el bundle del router que los
importa.

### 3. Query Parameters

Las acciones se especifican mediante query parameters:

**Antes:**
```
POST /api/import/facebook-link
POST /api/admin/moderation
GET  /api/og?slug=mi-perro
```

**Después:**
```
POST /api/import?action=link
POST /api/admin?resource=moderation
GET  /api/seo?action=og&slug=mi-perro
```

## Actualización del Frontend

```typescript
// Antes
const response = await fetch('/api/import/facebook-link', { ... });

// Después
const response = await fetch('/api/import?action=link', { ... });
```

Los rewrites de `vercel.json` mantienen las rutas públicas `/sitemap.xml` y la
variante para bots de `/p/:slug`, además de los alias `/api/og` y `/api/sitemap`.

## Beneficios

1. **Optimización de recursos**
   - De 12 funciones a 8
   - 4 slots libres para crecimiento

2. **Mejor organización**
   - Endpoints relacionados agrupados lógicamente
   - Documentación centralizada por dominio

3. **Mantenimiento simplificado**
   - Un solo punto de entrada por dominio
   - Rate limiting consistente
   - Manejo de errores unificado

4. **Compatibilidad**
   - Los handlers internos mantienen su estructura
   - Fácil rollback si es necesario
   - Testing individual preservado

## Garantía Automática

`src/lib/__tests__/api-functions.test.ts` cuenta los archivos de `api/` con la
misma regla que Vercel (extensiones ejecutables, sin `.d.ts` y sin rutas ni
archivos con prefijo `_`) y falla si se superan las 12 funciones. El CI lo
ejecuta antes del deploy.

## Rate Limits Preservados

Cada acción mantiene su rate limit independiente:

| Acción | Límite | Ventana |
|--------|--------|---------|
| `extract-from-image` | 5 | 1 minuto |
| `calculate-matches` | 30 | 1 hora |
| `create-match` | 50 | 1 hora |
| `detect-duplicates` | 20 | 1 hora |
| `process-publication` | 20 | 1 hora |
| `process-job` | Interno | - |
| `publication-create` | 10 | 1 hora |
| `validate-upload` | 50 | 1 hora |

## Monitoreo

Para verificar el estado en producción:

```bash
# Health check
curl https://tu-dominio.vercel.app/api/health

# Probar endpoint de IA
curl -X POST https://tu-dominio.vercel.app/api/ai?action=extract-from-image \
  -H "Content-Type: application/json" \
  -d '{"image": "base64..."}'
```

## Próximos Pasos

Si se necesitan más funciones en el futuro:

1. Evaluar si pueden consolidarse en endpoints existentes.
2. Si no, crear una función nueva solo cuando sea necesario.
3. Mantener margen de al menos 2-3 slots libres.
4. No editar una migración ya aplicada ni subir de plan como primera opción.

## Referencias

- [Vercel Serverless Functions Limits](https://vercel.com/docs/functions/serverless-functions/limits)
- Documentación completa: `api/README.md`
