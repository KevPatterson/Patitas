/**
 * Tipos mínimos de Vercel Functions (runtime Node.js).
 *
 * Por qué existen: antes se importaban desde `@vercel/node`, que arrastraba un
 * árbol de dependencias de desarrollo con 12 avisos de seguridad (undici,
 * path-to-regexp, ts-morph, fast-glob, micromatch, braces, ajv, esbuild) y que
 * además no es el runtime real de Vercel. Solo se usaban los tipos, así que los
 * declaramos aquí y eliminamos la dependencia.
 *
 * IMPORTANTE: al ser un shim, `body` y `query` son `any` a propósito. Eso
 * obliga a validar con Zod en cada endpoint en vez de confiar en un casteo
 * (ver regla "Zod para toda entrada externa").
 *
 * Si algún día se necesita el runtime completo (por ejemplo `res.cookie` o
 * `req.on`), se debe volver a instalar `@vercel/node` como dependencia de
 * desarrollo y borrar este archivo.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { IncomingMessage, ServerResponse } from 'node:http';

export interface VercelRequestCookies {
  [key: string]: string;
}

/** `req.query` con comodines ya resueltos por el router de Vercel. */
export interface VercelRequestQuery {
  [key: string]: string | string[] | undefined;
}

export interface VercelRequest extends IncomingMessage {
  /** Cuerpo ya parseado por Vercel (JSON, texto o form-data según el caso). */
  body: any;
  query: VercelRequestQuery;
  cookies: VercelRequestCookies;
}

export interface VercelResponse extends ServerResponse {
  status(statusCode: number): VercelResponse;
  json(body: any): VercelResponse;
  send(body: any): VercelResponse;
  redirect(statusOrUrl: number | string, url?: string): VercelResponse;
}
