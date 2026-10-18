/**
 * Serialización segura de JSON-LD.
 *
 * Por qué existe: hoy el JSON-LD se inyecta con `script.textContent = data`, que
 * **no** reparsea HTML y por tanto no es explotable (no hay XSS con un
 * `<script>` dentro de una descripción). Pero eso es una propiedad frágil: si
 * mañana alguien mueve la inyección a una plantilla HTML, a un `innerHTML` o a
 * renderizado en servidor, un título como
 *
 *     Perro perdido </script><script>alert(1)</script>
 *
 * rompe el contexto y ejecuta código.
 *
 * `safeJsonLd()` escapa `<`, `>` y `&` como secuencias Unicode (`\u003c`, …).
 * Sigue siendo JSON válido —los crawlers lo parsean igual— y ningún navegador
 * puede cerrar el `<script>` con esos caracteres.
 */
export function safeJsonLd(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    // U+2028 y U+2029 son válidos en JSON pero rompen un literal de JS.
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
