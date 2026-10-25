/**
 * Formato canónico del mensaje firmado por la ingesta externa.
 *
 * Vive en su propio módulo (y no dentro del handler) para poder probarlo sin
 * cargar el cliente de Supabase ni requerir variables de entorno.
 *
 * La firma la produce el worker de Python en
 * `workers/telegram-collector/auth.py`:
 *
 *     message = f"{timestamp}.".encode() + json.dumps(
 *         payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False
 *     ).encode("utf-8")
 *
 * donde `payload` son los campos de contenido SIN `timestamp` ni `signature`.
 *
 * `ensure_ascii=False` no es un detalle: `JSON.stringify` emite los caracteres
 * no ASCII tal cual, mientras que el valor por defecto de Python (True) los
 * escapaba como `\uXXXX`. Con acentos o emoji en `raw_text` los bytes firmados
 * diferían y la ingesta devolvía 401 «Firma inválida».
 *
 * Antes de la Fase 1 el servidor calculaba otra cosa (JSON sin ordenar y sin el
 * prefijo del timestamp y, además, sin cubrir `raw_text` ni `image_paths`), así
 * que **ninguna firma del worker podía validar** y el contenido iba sin firmar.
 */

export type CanonicalIngestInput = {
  source_id: string;
  platform: string;
  external_id: string;
  source_url: string;
  raw_text?: string | null;
  image_paths: string[];
  posted_at: string;
  timestamp: number;
};

/**
 * Devuelve el mensaje exacto que hay que pasar al HMAC-SHA256.
 *
 * Cualquier cambio aquí debe replicarse en el worker de Python; hay tests que
 * fijan el vector esperado.
 */
export function canonicalIngestPayload(data: CanonicalIngestInput): string {
  // Mismos campos y mismos valores por defecto que el modelo Pydantic del
  // worker (raw_text None -> null, image_paths [] si no viene).
  const content: Record<string, unknown> = {
    source_id: data.source_id,
    platform: data.platform,
    external_id: data.external_id,
    source_url: data.source_url,
    raw_text: data.raw_text ?? null,
    image_paths: data.image_paths ?? [],
    posted_at: data.posted_at,
  };

  // `sort_keys=True` de Python ordena alfabéticamente; `separators=(",", ":")`
  // elimina los espacios. JSON.stringify sin `space` ya no separa con espacios,
  // y el orden de inserción del objeto construido replica el orden ordenado.
  const sortedKeys = Object.keys(content).sort();
  const ordered: Record<string, unknown> = {};

  for (const key of sortedKeys) {
    ordered[key] = content[key];
  }

  return `${data.timestamp}.${JSON.stringify(ordered)}`;
}
