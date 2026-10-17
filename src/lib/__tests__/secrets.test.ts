import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

/**
 * Garantía permanente del hallazgo API-10: la service role key de Supabase
 * bypasea RLS, así que NO puede aparecer en `src/` (que acaba en el bundle del
 * navegador). El código de servidor vive en `api/_lib`.
 *
 * Esta prueba falla si alguien la importa o la menciona en el frontend, que es
 * exactamente el error que convierte un descuido en una brecha total.
 */

const SRC_DIR = join(process.cwd(), 'src');

/** Patrones prohibidos en el frontend. */
const FORBIDDEN = [
  'SUPABASE_SERVICE_ROLE_KEY',
  'SERVICE_ROLE_KEY',
  'service_role_key',
  'service_role',
];

function walk(dir: string): string[] {
  const out: string[] = [];

  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);

    if (stats.isDirectory()) {
      // El propio test contiene los patrones prohibidos: se excluye.
      if (entry === '__tests__') continue;
      out.push(...walk(full));
    } else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry)) {
      out.push(full);
    }
  }

  return out;
}

describe('secretos fuera del frontend', () => {
  it('src/ no menciona la service role key ni el rol service_role', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');

      for (const pattern of FORBIDDEN) {
        if (content.includes(pattern)) {
          offenders.push(`${relative(process.cwd(), file)} contiene "${pattern}"`);
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('src/ no importa nada desde api/', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');
      // Import relativo hacia api/ o alias que resuelva ahí.
      if (/from\s+['"][^'"]*\bapi\//.test(content) || /import\(\s*['"][^'"]*\bapi\//.test(content)) {
        offenders.push(relative(process.cwd(), file));
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });

  it('el proyecto frontend no expone variables de entorno de servidor', () => {
    const offenders: string[] = [];

    for (const file of walk(SRC_DIR)) {
      const content = readFileSync(file, 'utf8');

      // Solo las variables con prefijo VITE_ llegan al bundle; import.meta.env
      // de otra cosa no existe en el cliente, pero se comprueba igual.
      const matches = content.match(/import\.meta\.env\.([A-Z0-9_]+)/g) ?? [];

      for (const match of matches) {
        const name = match.replace('import.meta.env.', '');
        if (!name.startsWith('VITE_') && name !== 'MODE' && name !== 'DEV' && name !== 'PROD') {
          offenders.push(`${relative(process.cwd(), file)}: ${name}`);
        }
      }
    }

    expect(offenders, offenders.join('\n')).toEqual([]);
  });
});
