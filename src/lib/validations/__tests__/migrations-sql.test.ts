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

  it('acepta la suite pgTAP (transacciones con rollback)', () => {
    const result = runValidator(resolve(process.cwd(), 'supabase', 'tests'));

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

  /**
   * Regresión real: la migración 0013 llegó a aplicarse con
   * `create trigger ... after select`, que PostgreSQL rechaza con
   * `42601: syntax error at or near "select"`. El validador debe detectarlo antes
   * de que llegue a la base de datos.
   */
  it('detecta un trigger sobre SELECT (no soportado por PostgreSQL)', () => {
    withMigrations(
      {
        '0099_roto.sql': [
          'create trigger publications_contact_reveal_quota',
          '  after select on public.publications',
          '  for each row',
          '  execute function public.tg_contact_reveal_quota();',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('evento "select" no válido');
      }
    );
  });

  it('detecta TRUNCATE con FOR EACH ROW', () => {
    withMigrations(
      {
        '0099_roto.sql':
          'create trigger t after truncate on public.x for each row execute function public.f();',
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('TRUNCATE no admite FOR EACH ROW');
      }
    );
  });

  it('acepta triggers válidos sobre INSERT, UPDATE y DELETE', () => {
    withMigrations(
      {
        '0099_ok.sql': [
          'create trigger t1 before insert on public.x for each row execute function public.f();',
          'create trigger t2 after update on public.x for each row execute function public.f();',
          'create trigger t3 after delete or update on public.x for each row execute function public.f();',
          'create trigger t4 before truncate on public.x execute function public.f();',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(true);
        expect(result.output).toContain('Errores: 0');
      }
    );
  });

  it('detecta GRANT/REVOKE sobre una función con sobrecarga y sin firma', () => {
    withMigrations(
      {
        '0099_roto.sql': [
          'create or replace function public.dup(a int) returns int language sql as $$ select 1 $$;',
          'create or replace function public.dup(a int, b int) returns int language sql as $$ select 1 $$;',
          'revoke all on function public.dup from public;',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('sin firma, pero hay 2 versiones');
      }
    );
  });

  /**
   * Regresión real: un bloque DO recorría `cfg text[][]` con `r := cfg[i]` y
   * usaba `format('%I', r[6])`. El 6.º elemento llegó NULL y PostgreSQL falló con
   * `22004: null values cannot be formatted as an SQL identifier`.
   */
  it('detecta un array bidimensional (slicing propenso a desalinearse)', () => {
    withMigrations(
      {
        '0099_roto.sql': [
          'do $do$',
          'declare',
          "  cfg text[][] := array[['a','b'],['c','d']];",
          'begin',
          '  raise notice \'%\', cfg[1];',
          'end',
          '$do$;',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('array bidimensional');
      }
    );
  });

  it('acepta un bucle sobre `values` con columnas nombradas', () => {
    withMigrations(
      {
        '0099_ok.sql': [
          'do $do$',
          'declare r record;',
          'begin',
          '  for r in',
          "    select * from (values ('comments', 'author_profile_id')) as t(tbl, col)",
          '  loop',
          "    raise notice '% %.%', r.tbl, r.tbl, r.col;",
          '  end loop;',
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

  /**
   * Regresión real: la 0014 revocaba privilegios con firmas inventadas
   * (9 args en vez de 11; `text` en vez de `vector`) y el `exception` las omitía
   * en silencio, así que el REVOKE nunca se aplicaba.
   */
  it('detecta una firma con el número de argumentos equivocado', () => {
    withMigrations(
      {
        '0099_roto.sql': [
          'create or replace function public.buscar(a text, b text, c text) returns int language sql as $$ select 1 $$;',
          'revoke all on function public.buscar(text, text) from public;',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('firma incorrecta');
        expect(result.output).toContain('3:text');
      }
    );
  });

  it('detecta una firma con el tipo del primer argumento equivocado', () => {
    withMigrations(
      {
        '0099_roto.sql': [
          'create or replace function public.buscar_vec(q vector(1536), t real) returns int language sql as $$ select 1 $$;',
          'revoke all on function public.buscar_vec(text, real) from public;',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('firma incorrecta');
        expect(result.output).toContain('2:vector');
      }
    );
  });

  it('acepta la firma correcta (incluido el tipo vector con typmod)', () => {
    withMigrations(
      {
        '0099_ok.sql': [
          'create or replace function public.buscar_vec(q vector(1536), t real) returns int language sql as $$ select 1 $$;',
          'revoke all on function public.buscar_vec(public.vector, real) from public;',
          'grant execute on function public.buscar_vec(public.vector, real) to authenticated;',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(true);
        expect(result.output).toContain('Errores: 0');
      }
    );
  });

  it('detecta un GRANT/REVOKE sobre una función que no existe', () => {
    withMigrations(
      {
        '0099_roto.sql': 'revoke all on function public.no_existe(uuid) from public;',
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('no se declara en ninguna migración');
      }
    );
  });

  it('detecta sintaxis de MySQL', () => {
    withMigrations(
      {
        '0099_roto.sql': [
          'create table t (id int auto_increment primary key);',
          'select ifnull(a, 1) from public.x;',
          'select * from public.x limit 1, 2;',
        ].join('\n'),
      },
      (dir) => {
        const result = runValidator(dir);
        expect(result.ok).toBe(false);
        expect(result.output).toContain('generated by default as identity');
        expect(result.output).toContain('coalesce');
        expect(result.output).toContain('limit N offset M');
      }
    );
  });
});
