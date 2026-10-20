import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Variables de servidor: SIN prefijo VITE_ para no exponerlas al bundle del cliente.
// Se mantiene fallback a VITE_SUPABASE_URL para compatibilidad local si aún no migraste en Vercel.
// `SUPABASE_SECRET_KEY` es el nombre de la nueva clave secreta de Supabase; se
// acepta como alternativa para no romper despliegues que ya migraron.
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SECRET_KEY;

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      'Missing Supabase server env vars. Requeridas: SUPABASE_URL (o VITE_SUPABASE_URL) y SUPABASE_SERVICE_ROLE_KEY (o SUPABASE_SECRET_KEY).'
    );
  }

  if (!client) {
    client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}

/**
 * Cliente con service role, inicializado de forma perezosa.
 *
 * Antes el cliente se creaba al importar el módulo. Si faltaba una variable de
 * entorno, TODAS las funciones de `api/` fallaban con
 * `FUNCTION_INVOCATION_FAILED`, incluso las que podían degradar con elegancia
 * (por ejemplo `/api/og`, que debe devolver una tarjeta genérica). Con el Proxy
 * el error se lanza en el primer uso y cada endpoint puede capturarlo.
 */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, property) {
    const activeClient = getClient();
    const value = Reflect.get(activeClient, property, activeClient);

    return typeof value === 'function' ? value.bind(activeClient) : value;
  },
});
