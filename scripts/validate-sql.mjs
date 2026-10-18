#!/usr/bin/env node
/**
 * Validador estructural de las migraciones SQL de Supabase.
 *
 * ¿Por qué existe? No hay Postgres ni Docker en todos los entornos de
 * desarrollo/CI, y los parsers SQL de npm (`pgsql-ast-parser`, por ejemplo) no
 * entienden los cuerpos PL/pgSQL: fallan incluso con migraciones ya aplicadas en
 * producción. Esto no sustituye a `supabase db reset`, pero detecta de forma
 * fiable los errores que más se cuelan en migraciones grandes:
 *
 *   1. Bloques dollar-quoted ($$ ... $$, $fn$ ... $fn$) sin cerrar.
 *   2. `begin`/`end` desbalanceados dentro de los cuerpos plpgsql.
 *   3. `end` sin bloque que cerrar, o ámbitos que quedan abiertos.
 *   4. `create policy` / `create trigger` duplicados en el mismo archivo.
 *   5. `drop policy`/`drop trigger`/`drop function` sin `if exists` (no es
 *      idempotente: rompe al reaplicar la migración).
 *
 * Uso:  node scripts/validate-sql.mjs [directorio]
 * CI:   se ejecuta como test de vitest (src/lib/validations/__tests__).
 */

import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const args = process.argv.slice(2);
const dirFlagIndex = args.indexOf('--dir');
const MIGRATIONS_DIR =
  dirFlagIndex === -1 ? join(process.cwd(), 'supabase', 'migrations') : args[dirFlagIndex + 1];

/**
 * Recorre el SQL y devuelve:
 *   - `openers`: dollar-quotes que quedaron sin cerrar.
 *   - `code`:    el SQL con comentarios y literales de cadena reemplazados por
 *                espacios, pero CONSERVANDO los cuerpos dollar-quoted (que es
 *                donde vive el PL/pgSQL que hay que analizar).
 */
function scan(sql) {
  const openers = [];
  let code = '';
  let i = 0;

  while (i < sql.length) {
    const two = sql.slice(i, i + 2);

    // Comentario de línea.
    if (two === '--') {
      const nl = sql.indexOf('\n', i);
      const end = nl === -1 ? sql.length : nl;
      code += ' '.repeat(end - i);
      i = end;
      continue;
    }

    // Comentario de bloque.
    if (two === '/*') {
      const close = sql.indexOf('*/', i + 2);
      const end = close === -1 ? sql.length : close + 2;
      code += sql.slice(i, end).replace(/[^\n]/g, ' ');
      i = end;
      continue;
    }

    // Literal de cadena (con '' como escape).
    if (sql[i] === "'") {
      let j = i + 1;
      while (j < sql.length) {
        if (sql[j] === "'" && sql[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (sql[j] === "'") break;
        j++;
      }
      const end = Math.min(j + 1, sql.length);
      code += ' '.repeat(end - i);
      i = end;
      continue;
    }

    // Dollar-quote: se conserva el contenido (cuerpo de la función).
    if (sql[i] === '$') {
      const m = /^\$([A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (m) {
        const tag = m[1] ?? '';
        const delimiter = m[0];
        const close = sql.indexOf(delimiter, i + delimiter.length);

        if (close === -1) {
          openers.push({ tag, index: i });
          i = sql.length;
          continue;
        }

        const end = close + delimiter.length;
        code += sql.slice(i, end);
        i = end;
        continue;
      }
    }

    code += sql[i];
    i++;
  }

  return { openers, code };
}

/**
 * Enmascara keywords que NO abren un bloque, para que el emparejamiento
 * begin/end/case sea fiable:
 *
 *   - `if not exists`             -> el `if` es parte de la cláusula.
 *   - `loop` (todos)              -> `for ... loop`, `while ... loop` y
 *                                    `end loop` quedan como `for ...` / `end`.
 *                                    Se enmascara TODOS y no un rango `for...loop`
 *                                    porque un rango con [\s\S]*? cruza fronteras
 *                                    de funciones y desbalancea la pila.
 *   - `end if` / `end case`       -> pares ya balanceados.
 *
 * Los `if`/`case`/`begin` que sí abren bloque quedan intactos.
 */
function maskNonBlockKeywords(code) {
  return code
    .replace(/\bif\s+not\s+exists\b/gi, ' ')
    .replace(/\bloop\b/gi, ' ')
    .replace(/\bend\s+(if|case)\b/gi, 'END_CLAUSE');
}

/**
 * Empareja bloques con una pila y reporta desbalances.
 *
 * Distingue tres aperturas, porque `begin` significa dos cosas distintas:
 *   `begin;`           -> transacción (la cierra un `end;` o un `commit;`)
 *   `begin` (sin `;`)  -> bloque plpgsql (lo cierra un `end;`)
 *   `case ... end`     -> expresión CASE
 * No tolerar `end` sobrantes es el objetivo: es exactamente el error que se
 * cuela al pegar bloques de otra migración.
 */
function checkBlocks(code) {
  const errors = [];
  const masked = maskNonBlockKeywords(code);
  const tokens = masked.match(/\b(begin|end|case|if)\b\s*;?/gi) ?? [];
  const stack = [];

  for (const raw of tokens) {
    const hasSemicolon = raw.trim().endsWith(';');
    const tok = raw.trim().replace(/;$/, '').toLowerCase();

    if (tok === 'begin') {
      stack.push(hasSemicolon ? 'tx' : 'begin');
      continue;
    }

    if (tok === 'case') {
      stack.push('case');
      continue;
    }

    if (tok === 'end') {
      const top = stack[stack.length - 1];

      if (top === 'case' || top === 'begin' || top === 'tx') {
        stack.pop();
        continue;
      }

      if (top === undefined) {
        errors.push(`"${raw.trim()}" sin bloque que cerrar`);
        continue;
      }

      errors.push(`"end" no cierra el bloque abierto ("${top}")`);
      continue;
    }
    // `if` abre un bloque que se cierra con `end if`, ya enmascarado arriba.
  }

  for (const leftover of stack) {
    errors.push(leftover === 'tx' ? 'transacción sin COMMIT/END' : `bloque "${leftover}" sin cerrar`);
  }

  return errors;
}

function lineOf(sql, index) {
  return sql.slice(0, index).split('\n').length;
}

function validateFile(file) {
  const path = join(MIGRATIONS_DIR, file);
  const sql = readFileSync(path, 'utf8');
  const errors = [];

  const { openers, code } = scan(sql);

  for (const q of openers) {
    errors.push(
      `dollar-quote sin cerrar (${q.tag === '' ? '$$' : `$${q.tag}$`}) en la línea ${lineOf(sql, q.index)}`
    );
  }

  if (openers.length === 0) {
    errors.push(...checkBlocks(code));
  }

  let m;

  // create policy duplicado en el mismo archivo.
  const policyNames = new Map();
  const policyRe = /create\s+policy\s+"([^"]+)"/gi;
  while ((m = policyRe.exec(code)) !== null) {
    const name = m[1];
    const line = lineOf(sql, m.index);
    if (policyNames.has(name)) {
      errors.push(`create policy duplicado "${name}" (líneas ${policyNames.get(name)} y ${line})`);
    } else {
      policyNames.set(name, line);
    }
  }

  // create trigger duplicado en el mismo archivo.
  const triggerNames = new Map();
  const triggerRe = /create\s+trigger\s+([A-Za-z_][A-Za-z0-9_]*)/gi;
  while ((m = triggerRe.exec(code)) !== null) {
    const name = m[1].toLowerCase();
    const line = lineOf(sql, m.index);
    if (triggerNames.has(name)) {
      errors.push(`create trigger duplicado "${name}" (líneas ${triggerNames.get(name)} y ${line})`);
    } else {
      triggerNames.set(name, line);
    }
  }

  // Idempotencia: los drop deben llevar "if exists".
  const dropRe = /drop\s+(policy|trigger|function|table|index|column)\s+(?!if\s+exists)([A-Za-z_"][^\s;(]*)/gi;
  while ((m = dropRe.exec(code)) !== null) {
    // Las migraciones 0001-0010 están congeladas y no se tocan.
    if (/^000[1-9]|^0010/.test(file)) break;
    errors.push(`drop ${m[1]} sin "if exists" en la línea ${lineOf(sql, m.index)}: ${m[2]}`);
  }

  return errors;
}

const files = readdirSync(MIGRATIONS_DIR)
  .filter((f) => f.endsWith('.sql'))
  .sort();

if (files.length === 0) {
  console.error('No se encontraron migraciones en', relative(process.cwd(), MIGRATIONS_DIR));
  process.exit(1);
}

let totalErrors = 0;

for (const file of files) {
  const errors = validateFile(file);

  if (errors.length === 0) {
    console.log(`OK    ${file}`);
  } else {
    totalErrors += errors.length;
    console.log(`FALLA ${file}`);
    for (const e of errors) console.log(`        - ${e}`);
  }
}

console.log('');
console.log(`Migraciones analizadas: ${files.length}. Errores: ${totalErrors}.`);

process.exit(totalErrors === 0 ? 0 : 1);
