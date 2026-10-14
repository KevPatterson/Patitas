/**
 * Interfaz genérica para adaptadores de fuentes externas.
 * Permite implementar diferentes fuentes (Telegram, Facebook, etc.) de forma consistente.
 */

import type { ExternalPlatform } from '../../types/index';

/** Post crudo obtenido de una fuente externa */
export interface RawPost {
  /** ID único en la plataforma origen */
  external_id: string;
  /** URL permanente al post original */
  source_url: string;
  /** Texto completo del post */
  raw_text: string | null;
  /** URLs de imágenes (ya subidas a Storage) */
  image_paths: string[];
  /** Fecha original del post */
  posted_at: string;
  /** Datos extraídos opcionales */
  extracted?: Record<string, unknown>;
}

/** Configuración de una fuente para el adaptador */
export interface SourceConfig {
  id: string;
  platform: ExternalPlatform;
  handle_or_url: string;
  name: string | null;
  province: string | null;
  is_active: boolean;
  is_trusted: boolean;
  last_cursor: string | null;
}

/** Resultado de fetchPublic */
export interface FetchResult {
  /** Posts nuevos obtenidos */
  posts: RawPost[];
  /** Nuevo cursor para próxima ejecución */
  new_cursor: string | null;
  /** Error si ocurrió (para no romper el flujo) */
  error?: string;
}

/** Interfaz que deben implementar todos los adaptadores */
export interface SourceAdapter {
  /** Identificador único del adaptador */
  readonly name: string;
  /** Plataforma que maneja */
  readonly platform: ExternalPlatform;
  /** Si el adaptador está habilitado (feature flag) */
  readonly enabled: boolean;

  /**
   * Obtiene posts públicos desde la fuente.
   * @param source Configuración de la fuente
   * @param lastCursor Último cursor procesado (para lectura incremental)
   * @returns Posts nuevos y nuevo cursor
   */
  fetchPublic(source: SourceConfig, lastCursor: string | null): Promise<FetchResult>;

  /**
   * Verifica si la fuente es accesible (health check).
   * Útil para validar configuración antes de activar.
   */
  checkHealth(source: SourceConfig): Promise<boolean>;
}

/**
 * Factoría para obtener adaptadores según la plataforma.
 * Respeta feature flags y configuración.
 */
export function getAdapter(platform: ExternalPlatform): SourceAdapter | null {
  // Import dinámico para evitar dependencias circulares
  // y cargar solo lo necesario
  switch (platform) {
    case 'FACEBOOK_PUBLIC':
      // Se importará bajo feature flag
      return null; // Por ahora, FacebookPublicAdapter se importa aparte
    case 'TELEGRAM':
      // Telegram usa worker Python separado, no adaptador JS
      return null;
    default:
      return null;
  }
}