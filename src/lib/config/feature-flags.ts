/**
 * Feature Flags - Configuración centralizada de características experimentales
 * Todas deshabilitadas por defecto (fail-safe)
 */

// Feature flags del lado del cliente (expuestas al navegador con VITE_)
export const FEATURE_FLAGS = {
  /** Habilitar adaptador de Facebook Público (best-effort, solo metadatos OG) */
  facebookAdapter: import.meta.env.VITE_FACEBOOK_ADAPTER_ENABLED === 'true',
  
  /** Habilitar auto-publicación de posts importados (requiere fuente trusted + confidence alto) */
  ingestAutoPublish: import.meta.env.VITE_INGEST_AUTOPUBLISH === 'true',
  
  /** Habilitar búsqueda semántica (requiere pgvector en Supabase) */
  semanticSearch: import.meta.env.VITE_SEMANTIC_SEARCH_ENABLED === 'true',
  
  /** Habilitar matching visual (requiere embeddings de imágenes) */
  visualMatching: import.meta.env.VITE_VISUAL_MATCHING_ENABLED === 'true',
  
  /** Habilitar OCR real (requiere proveedor configurado) */
  realOcr: import.meta.env.VITE_REAL_OCR_ENABLED === 'true',

  /**
   * Funciones de IA en la UI (coincidencias, duplicados, autocompletado por OCR).
   *
   * Desactivadas por defecto (tarea 5.4): mientras el proveedor configurado sea
   * `MOCK`, los resultados son inventados y presentarlos como reales engaña al
   * usuario. El endpoint `/api/ai` sigue disponible para administración y pruebas,
   * pero la interfaz no muestra esos paneles hasta que haya un proveedor real.
   *
   * Se activa con `VITE_AI_ENABLED=true`.
   */
  ai: import.meta.env.VITE_AI_ENABLED === 'true',
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

/**
 * Verificar si una feature flag está habilitada
 */
export function isFeatureEnabled(flag: FeatureFlag): boolean {
  return FEATURE_FLAGS[flag];
}

/**
 * Obtener todas las feature flags (para debug/admin)
 */
export function getAllFeatureFlags(): Record<FeatureFlag, boolean> {
  return { ...FEATURE_FLAGS };
}