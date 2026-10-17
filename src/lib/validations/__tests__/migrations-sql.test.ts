import { describe, expect, it } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

/**
 * El validador de migraciones es la única red de seguridad estática que tenemos
 * sobre `supabase/migrations` (no hay Postgres ni Docker en CI). Si él mismo se
 * rompe en silencio, las migraciones llegan a producción sin ninguna revisión.
 *
 * Por eso se prueban las dos caras:
 *   - acepta las migraciones reales del repositorio,
 *   - y RECHAZA cada clase de error que dice detectar.
 */

const SCRIPT = resolve(process.cwd(), 'scripts', 'validate-sql.mjs');

function runValidator(dir) {
  try {
    const stdout = execFileSync(process.execPath, [SCRIPT, '--dir', dir], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    return { ok: true, output: stdout };
  } catch (error) {
    const e = error;
    return { ok: false, output: `${e.stdout ?? ''}${e.stderr ?? ''}` };
  }
}

/** Crea un directorio temporal con las migraciones indicadas y lo limpia al final. */
function withMigrations(files, fn) {
  const dir = mkdtempSync(join(tmpdir(), 'patitas-sql-'));
  try {
    for (const [name, sql] of Object.entries(files)) {
      writeFileSync(join(dir, name), sql, 'utf8');
    }
    return fn(dir);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('validador de migraciones SQL', () => {
  it('acepta todas las migraciones reales del repositorio', () => {
    const result = runValidator(resolve(process.cwd(), 'supabase', 'migrations'));

    expect(result.output).toContain('Errores: 0');
    expect(result.ok).toBe(true);
  });

  it('detecta un bloque dollar-quoted sin cerrar', () => {
    withMigrations(
      {
        '0099_roto.sql': 'create function public.f() returns void language plpgsql as $$\nbegin\n  return;\n',
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('dollar-quote sin cerrar');
      }
    );
  });

  it('detecta un bloque plpgsql sin cerrar', () => {
    withMigrations(
      {
        '0099_roto.sql': 'do $do$\nbegin\n  perform 1;\n$do$;\n',
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('sin cerrar');
      }
    );
  });

  it('detecta un `end` sin bloque que cerrar', () => {
    withMigrations(
      {
        '0099_roto.sql': 'do $do$\nbegin\n  return;\nend;\nend;\n$do$;\n',
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('sin bloque que cerrar');
      }
    );
  });

  it('detecta una policy duplicada en el mismo archivo', () => {
    withMigrations(
      {
        '0099_roto.sql': [
          'create policy "p" on public.t for select using (true);',
          'create policy "p" on public.t for insert with check (true);',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('create policy duplicado');
      }
    );
  });

  it('detecta un drop sin `if exists` (migración no idempotente)', () => {
    withMigrations(
      {
        '0099_roto.sql': 'drop trigger locations_fuzz_coordinates on public.locations;\n',
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('sin "if exists"');
      }
    );
  });

  it('no se confunde con `if not exists` ni con `for ... loop`', () => {
    withMigrations(
      {
        '0099_ok.sql': [
          'create table if not exists public.t (id uuid primary key);',
          'create index if not exists t_idx on public.t (id);',
          'do $do$',
          'declare i int;',
          'begin',
          '  for i in 1 .. 3 loop',
          '    raise notice \'%\', i;',
          '  end loop;',
          '  if i > 1 then',
          '    raise notice \'mayor\';',
          '  end if;',
          'end',
          '$do$;',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(true);
        expect(result.output).toContain('Errores: 0');
      }
    );
  });

  it('no cuenta como error los `end` de una expresión CASE', () => {
    withMigrations(
      {
        '0099_ok.sql': [
          'do $do$',
          'declare v int;',
          'begin',
          '  v := case when true then 1 else 2 end;',
          'end',
          '$do$;',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(true);
      }
    );
  });
});
