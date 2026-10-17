# Política de seguridad — Patitas

Patitas es una plataforma que maneja **datos personales sensibles**: la ubicación
aproximada de una mascota perdida puede llevar a la casa de su dueño, y los datos
de contacto identifican a personas reales. Un fallo aquí no es un bug de
producto: puede poner en riesgo físico a alguien.

## Versiones soportadas

El proyecto está en desarrollo activo (`0.x`). Solo la rama `main` recibe
correcciones de seguridad.

| Versión | Soportada |
|---------|-----------|
| `main` (última) | Sí |
| Ramas `fix/*`, `feat/*` | No (se integran o se descartan) |

## Cómo reportar una vulnerabilidad

**No abras un issue público.** Un issue público es un aviso para quien quiera
explotarlo antes de que exista el arreglo.

Escríbe a **kevinpatterson618@gmail.com** con:

1. Qué componente está afectado (frontend, `api/`, migraciones de Supabase,
   Storage, configuración de Vercel).
2. Pasos para reproducirlo, con el mínimo detalle necesario.
3. Impacto que estimas (¿qué datos se obtienen? ¿hace falta cuenta?).
4. Si lo deseas, una propuesta de arreglo.

Si prefieres GitHub, usa la pestaña **Security → Advisories → Report a
vulnerability** del repositorio (privado hasta que se publique el arreglo).

### Qué esperar

| Plazo | Compromiso |
|-------|------------|
| 3 días laborables | Confirmación de recepción |
| 10 días laborables | Valoración inicial y severidad |
| 30 días | Arreglo para severidad alta o crítica, si es viable |

Se te acreditará en el aviso público salvo que prefieras permanecer en el
anonimato.

## Alcance

**Dentro del alcance**

- Evasión de RLS o de los privilegios por columna (leer datos de otro usuario).
- Recuperar la ubicación exacta de una publicación a partir de la difuminada.
- Leer los datos de contacto saltándose `reveal_publication_contact()` o su cuota.
- Escalada de privilegios (llegar a `MODERATOR`/`ADMIN`).
- Subir contenido malicioso a Storage (SVG con script, ejecutables, imágenes con
  EXIF de geolocalización).
- SSRF a través de los endpoints que descargan URLs.
- XSS, open redirect, inyección en los endpoints de `/api`.
- Filtración de la `SUPABASE_SERVICE_ROLE_KEY` o cualquier secreto.

**Fuera del alcance**

- Ataques de fuerza bruta o denegación de servicio sin una vulnerabilidad detrás.
- Ingeniería social sobre el equipo o los usuarios.
- Vulnerabilidades en dependencias sin una ruta de explotación demostrable
  (repórtalas igualmente; se atienden vía Dependabot).
- Ausencia de cabeceras en previews de Vercel.
- Spam o contenido inapropiado: eso es moderación, no seguridad.

## Cómo se construye la seguridad aquí

La arquitectura es deliberada y conviene entenderla antes de reportar algo:

1. **El cliente habla directo con Supabase.** Por tanto, cualquier regla que
   viva solo en `/api` se puede saltar con la `anon key` + un JWT. Todo lo
   importante (RLS, cuotas, inmunización de columnas, triggers) está forzado
   **en la base de datos**.
2. **Las escrituras en Storage pasan por `/api/uploads`.** Los permisos de
   `storage.objects` se retiraron a `authenticated`, así que el saneado de
   imágenes (magic bytes, EXIF, GPS, tamaño) no se puede esquivar.
3. **Los datos de contacto no tienen `SELECT`** para `anon` ni `authenticated`:
   solo se obtienen por `reveal_publication_contact()`, con cuota y registro.
4. **La ubicación es determinista, no aleatoria.** Guardar la misma ubicación
   varias veces devuelve siempre el mismo punto difuminado, así que no se puede
   promediar para recuperar el punto real.

El detalle completo, hallazgo por hallazgo y con evidencia `archivo:línea`, está
en [docs/AUDITORIA_SEGURIDAD.md](./docs/AUDITORIA_SEGURIDAD.md).

## Higiene de secretos

- `SUPABASE_SERVICE_ROLE_KEY`, `INGEST_HMAC_SECRET`, `INTERNAL_API_KEY` y los
  tokens de Upstash **solo** existen como variables de entorno de servidor: nunca
  en el repositorio y nunca con prefijo `VITE_`.
- Un test (`src/lib/__tests__/secrets.test.ts`) falla si la service role key
  aparece en `src/`, si algo del frontend importa desde `api/` o si se lee una
  variable de entorno sin prefijo `VITE_`.
- Si sospechas que una clave se ha filtrado: rótala en el panel de Supabase o
  Vercel, no la borres del historial (el historial no es el problema, la clave
  viva sí).
