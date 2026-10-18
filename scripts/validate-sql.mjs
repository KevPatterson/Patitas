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
 * Devuelve el contenido entre paréntesis balanceados a partir de `openIndex`
 * (que debe apuntar al `(`). Necesario porque los tipos pueden llevar comas
 * dentro, como `numeric(9,6)` o `vector(1536)`.
 */
function balancedArgs(text, openIndex) {
  let depth = 0;

  for (let i = openIndex; i < text.length; i++) {
    if (text[i] === '(') depth++;
    else if (text[i] === ')') {
      depth--;
      if (depth === 0) return text.slice(openIndex + 1, i);
    }
  }

  return null;
}

/** Divide una lista de argumentos por comas de primer nivel. */
function splitTopLevel(text) {
  const parts = [];
  let depth = 0;
  let current = '';

  for (const char of text) {
    if (char === '(') depth++;
    if (char === ')') depth--;
    if (char === ',' && depth === 0) {
      parts.push(current);
      current = '';
      continue;
    }
    current += char;
  }

  if (current.trim() !== '') parts.push(current);
  return parts.map((p) => p.trim()).filter((p) => p !== '');
}

/** Normaliza un tipo: sin esquema, sin typmod y en minúsculas. */
function normalizeType(raw) {
  return raw
    .replace(/\([^)]*\)/g, '')
    .replace(/^public\./, '')
    .trim()
    .toLowerCase();
}

/**
 * Firma resumida de una lista de argumentos: `<nº args>:<tipo del primero>`.
 * Es suficiente para detectar los dos fallos reales que ya ocurrieron (contar mal
 * los argumentos y confundir `text` con `vector`) sin necesidad de un parser SQL.
 */
function signatureOf(argsText) {
  const args = splitTopLevel(argsText).map((arg) =>
    arg.replace(/\bdefault\b[\s\S]*$/i, '').trim()
  );

  if (args.length === 0) return '0:-';

  // El tipo es el último token; antes puede venir el modo y el nombre del arg.
  const firstType = normalizeType(args[0].split(/\s+/).pop());
  return `${args.length}:${firstType}`;
}

/** Registra una firma declarada en el índice. */
function registerSignature(map, name, argsText) {
  const fnName = name.toLowerCase();
  if (!map.has(fnName)) map.set(fnName, new Set());
  map.get(fnName).add(signatureOf(argsText));
}

/**
 * Índice de funciones declaradas en TODAS las migraciones, no solo en el archivo
 * actual: una migración posterior puede revocar privilegios de una función
 * creada antes.
 */
function buildRepoFunctionIndex() {
  const index = new Map();
  const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
    const re = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi;
    let match;

    while ((match = re.exec(sql)) !== null) {
      const argsText = balancedArgs(sql, match.index + match[0].length - 1);
      if (argsText === null) continue;
      registerSignature(index, match[1], argsText);
    }
  }

  return index;
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
  const tokens = masked.match(/\b(begin|end|case|if|commit|rollback)\b\s*;?/gi) ?? [];
  const stack = [];

  for (const raw of tokens) {
    const hasSemicolon = raw.trim().endsWith(';');
    const tok = raw.trim().replace(/;$/, '').toLowerCase();

    if (tok === 'begin') {
      stack.push(hasSemicolon ? 'tx' : 'begin');
      continue;
    }

    // `commit` / `rollback` cierran la transacción de los bloques de test.
    if (tok === 'commit' || tok === 'rollback') {
      if (stack[stack.length - 1] === 'tx') stack.pop();
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

  // ── Triggers: eventos permitidos por PostgreSQL ──────────────────────────
  //
  // Esta comprobación nace de un error real: una migración llegó a aplicarse con
  // `create trigger ... after select`, que PostgreSQL rechaza con
  //   ERROR 42601: syntax error at or near "select"
  // porque solo existe BEFORE/AFTER/INSTEAD OF sobre INSERT, UPDATE, DELETE y
  // TRUNCATE. Es un fallo que ninguna comprobación estructural detectaba y que se
  // descubre al ejecutar la migración, así que aquí se valida el evento contra
  // una allowlist.
  const TRIGGER_EVENTS = new Set(['insert', 'update', 'delete', 'truncate']);
  const triggerStmtRe =
    /create\s+(?:or\s+replace\s+)?trigger\s+([A-Za-z_][A-Za-z0-9_]*)([\s\S]{0,400}?);/gi;

  while ((m = triggerStmtRe.exec(code)) !== null) {
    const name = m[1];
    const body = m[2];
    const line = lineOf(sql, m.index);

    const timingMatch = /\b(before|after|instead\s+of)\s+([a-z]+(?:\s+or\s+[a-z]+)*)/i.exec(body);

    if (!timingMatch) {
      errors.push(`trigger "${name}" sin BEFORE/AFTER/INSTEAD OF (línea ${line})`);
      continue;
    }

    const events = timingMatch[2]
      .toLowerCase()
      .split(/\s+or\s+/)
      .map((e) => e.trim());

    for (const event of events) {
      if (!TRIGGER_EVENTS.has(event)) {
        errors.push(
          `trigger "${name}": evento "${event}" no válido en PostgreSQL (línea ${line}); ` +
            'solo INSERT, UPDATE, DELETE y TRUNCATE'
        );
      }
    }

    // TRUNCATE solo admite triggers de sentencia, nunca FOR EACH ROW.
    if (events.includes('truncate') && /for\s+each\s+row/i.test(body)) {
      errors.push(
        `trigger "${name}": TRUNCATE no admite FOR EACH ROW (línea ${line})`
      );
    }
  }

  // Otras sentencias con sintaxis de otro motor que suelen colarse.
  const foreignSyntax = [
    { re: /\bauto_increment\b/gi, msg: 'sintaxis MySQL: usa `generated by default as identity`' },
    { re: /\bunsigned\b/gi, msg: 'sintaxis MySQL: PostgreSQL no tiene `unsigned`' },
    { re: /\bengine\s*=\s*innodb\b/gi, msg: 'sintaxis MySQL: PostgreSQL no usa ENGINE' },
    { re: /\bifnull\s*\(/gi, msg: 'sintaxis MySQL: usa `coalesce(...)`' },
    { re: /\blimit\s+\d+\s*,\s*\d+/gi, msg: 'sintaxis MySQL: usa `limit N offset M`' },
  ];

  for (const { re, msg } of foreignSyntax) {
    while ((m = re.exec(code)) !== null) {
      errors.push(`${msg} (línea ${lineOf(sql, m.index)})`);
    }
  }

  // ── Arrays bidimensionales: fuente de errores silenciosos en PL/pgSQL ────
  //
  // Segunda regresión real: un bloque DO recorría `cfg text[][]` con
  // `r := cfg[i]` y luego usaba `format('%I', r[6])`. El 6.º elemento llegó NULL
  // y PostgreSQL falló con:
  //   ERROR 22004: null values cannot be formatted as an SQL identifier
  //
  // El slicing de arrays multidimensionales es fácil de desalinear y el fallo
  // aparece solo al ejecutar. La forma segura es una lista explícita de
  // sentencias o un bucle sobre `values (...)` con columnas nombradas.
  const nestedArrayRe = /\barray\s*\[\s*\[/gi;
  while ((m = nestedArrayRe.exec(code)) !== null) {
    errors.push(
      `array bidimensional en la línea ${lineOf(sql, m.index)}: usa sentencias explícitas o ` +
        'un bucle sobre `values (...)` con columnas nombradas (el slicing con subíndices se desalinea en silencio)'
    );
  }

  // ── GRANT/REVOKE contra las firmas REALES de las funciones ───────────────
  //
  // Tercera regresión real: la 0013 revocaba privilegios sobre
  // `search_publications(text, …, integer, integer)` (9 args) cuando la función
  // tiene 11, y sobre `search_similar_publications_by_text(text, …)` cuando el
  // primer argumento es `vector`. El `exception when undefined_function` las
  // omitía sin avisar, así que el REVOKE nunca llegaba a aplicarse.
  //
  // Aquí se compara (número de argumentos, tipo del primero) contra las firmas
  // declaradas en TODO el repositorio. Las funciones que usan el tipo `vector`
  // (pgvector) se comparan igual: si el tipo no existe en el entorno, la propia
  // migración emite un WARNING.
  const overloads = new Map();
  const fnDefRe = /create\s+(?:or\s+replace\s+)?function\s+public\.([a-z0-9_]+)\s*\(/gi;

  while ((m = fnDefRe.exec(code)) !== null) {
    const argsText = balancedArgs(code, m.index + m[0].length - 1);
    if (argsText === null) continue;
    registerSignature(overloads, m[1], argsText);
  }

  const ambiguousPrivilegeRe =
    /\b(?:grant|revoke)\b[\s\S]{0,60}?\bon\s+function\s+public\.([a-z0-9_]+)\s*(?=[,;]|from|to)/gi;

  while ((m = ambiguousPrivilegeRe.exec(code)) !== null) {
    const fnName = m[1].toLowerCase();
    const versions = overloads.get(fnName)?.size ?? 0;

    if (versions > 1) {
      errors.push(
        `GRANT/REVOKE sobre public.${fnName} sin firma, pero hay ${versions} versiones (línea ${lineOf(sql, m.index)})`
      );
    }
  }

  // Con firma explícita: debe casar con una función declarada en el repo.
  const signedPrivilegeRe =
    /\b(?:grant|revoke)\b[\s\S]{0,60}?\bon\s+function\s+public\.([a-z0-9_]+)\s*\(/gi;

  while ((m = signedPrivilegeRe.exec(code)) !== null) {
    const fnName = m[1].toLowerCase();
    const argsText = balancedArgs(code, m.index + m[0].length - 1);
    if (argsText === null) continue;

    const declared = repoFunctions.get(fnName);

    if (!declared || declared.size === 0) {
      errors.push(
        `GRANT/REVOKE sobre public.${fnName}, que no se declara en ninguna migración (línea ${lineOf(sql, m.index)})`
      );
      continue;
    }

    const wanted = signatureOf(argsText);

    if (!declared.has(wanted)) {
      errors.push(
        `firma incorrecta en GRANT/REVOKE de public.${fnName}: "${wanted}" ` +
          `(declaradas: ${[...declared].join(', ')}) (línea ${lineOf(sql, m.index)})`
      );
    }
  }

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

// Índice global de firmas: una migración puede ajustar privilegios de una función
// declarada en una migración anterior.
const repoFunctions = buildRepoFunctionIndex();

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
