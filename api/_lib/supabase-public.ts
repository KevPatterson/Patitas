import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(
  /\/$/,
  ''
);
const supabasePublicKey =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

/**
 * Cliente con la clave pública para lecturas que RLS ya permite a cualquiera
 * (`/api/seo?action=og` y `/api/seo?action=sitemap`). No necesita service role: así estos endpoints
 * siguen funcionando aunque la clave de servidor no esté configurada.
 *
 * Devuelve `null` si falta configuración para que cada endpoint pueda degradar
 * sin lanzar un error al importar el módulo.
 */
export function getSupabasePublic(): SupabaseClient | null {
  if (!supabaseUrl || !supabasePublicKey) return null;

  if (!client) {
    client = createClient(supabaseUrl, supabasePublicKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return client;
}
