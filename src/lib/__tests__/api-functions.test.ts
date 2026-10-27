import { describe, expect, it } from 'vitest';
import { readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

/**
 * Garantía permanente del límite del plan Hobby de Vercel: un deployment no
 * puede tener más de 12 Serverless Functions. Al pasarse, el deploy falla con
 * "No more than 12 Serverless Functions can be added to a Deployment on the
 * Hobby plan", que es un error tardío y fácil de no ver hasta producción.
 *
 * Esta prueba cuenta los archivos de `api/` con la misma regla que aplica
 * Vercel:
 *   - cuentan las extensiones ejecutables (ts, tsx, js, jsx, mjs, cjs),
 *   - no cuentan los `.d.ts` (son solo tipos),
 *   - no cuenta nada dentro de una carpeta que empiece por `_` (por eso la
 *     lógica compartida vive en `api/_lib` y los tipos en `api/_types`),
 *   - no cuenta un archivo cuyo nombre empiece por `_`.
 *
 * Si falla, la solución no es subir de plan: hay que consolidar endpoints con
 * un router (`?action=` / `?resource=`) y mover el handler a `api/_lib/`.
 */

const API_DIR = join(process.cwd(), 'api');
const MAX_FUNCTIONS = 12;
const EXECUTABLE = /\.(ts|tsx|js|jsx|mjs|cjs)$/;
const DECLARATION = /\.d\.ts$/;

/** Recorre `api/` y devuelve las rutas que Vercel contaría como función. */
function walk(dir: string): string[] {
  const out: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      // Vercel ignora por completo las rutas con prefijo `_`.
      if (entry.startsWith('_')) continue;
      out.push(...walk(full));
      continue;
    }

    if (entry.startsWith('_')) continue;
    if (!EXECUTABLE.test(entry) || DECLARATION.test(entry)) continue;

    out.push(full);
  }

  return out;
}

describe('límite de Serverless Functions de Vercel', () => {
  it('api/ no supera las 12 funciones del plan Hobby', () => {
    const functions = walk(API_DIR)
      .map((file) => relative(API_DIR, file).split(sep).join('/'))
      .sort();

    // Un conteo en cero significaría que el test dejó de encontrar los archivos
    // (por ejemplo, un cambio de estructura), no que el proyecto esté limpio.
    expect(functions.length).toBeGreaterThan(0);

    const detail =
      `Hay ${functions.length} funciones en api/ y el plan Hobby permite ${MAX_FUNCTIONS}:\n` +
      functions.map((file) => `  - api/${file}`).join('\n') +
      '\n\nConsolida endpoints con un router (?action= / ?resource=) y mueve el ' +
      'handler a api/_lib/ en vez de crear un archivo nuevo en api/.';

    expect(functions.length, detail).toBeLessThanOrEqual(MAX_FUNCTIONS);
  });
});
