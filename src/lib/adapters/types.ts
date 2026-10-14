/**
 * Interfaz para adaptadores de fuentes externas
 * Permite agregar nuevas fuentes (Telegram, Facebook, Twitter, etc.) de forma consistente
 */

export type ExternalPlatform = 'TELEGRAM' | 'FACEBOOK_PUBLIC';

export interface RawPost {
  external_id: string;
  source_url: string;
  raw_text: string | null;
  image_urls: string[];
  posted_at: Date;
  author_hash?: string; // Hash del autor para detectar spam (sin datos personales)
  metadata: Record<string, unknown>;
}

export interface SourceAdapter {
  /** Identificador único del adaptador */
  readonly name: string;
  /** Plataforma que maneja */
  readonly platform: ExternalPlatform;
  /** Si el adaptador está habilitado (feature flag) */
  readonly enabled: boolean;
  
  /**
   * Obtiene posts públicos de una fuente específica
   * @param sourceConfig Configuración de la fuente (handle, URL, etc.)
   * @param since Cursor/fecha desde donde obtener posts nuevos
   * @returns Array de posts crudos
   */
  fetchPublic(sourceConfig: SourceConfig, since?: string): Promise<RawPost[]>;
  
  /**
   * Valida si una URL pertenece a esta plataforma
   */
  validateUrl(url: string): boolean;
  
  /**
   * Normaliza una URL a su forma canónica
   */
  normalizeUrl(url: string): string;
}

export interface SourceConfig {
  id: string;
  handle_or_url: string;
  name?: string;
  province?: string;
  is_trusted: boolean;
  last_cursor?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Factory para obtener adaptadores disponibles
 */
export function getAvailableAdapters(): SourceAdapter[] {
  return [
    // Se registran aquí cuando estén implementados
  ];
}

/**
 * Obtiene un adaptador por plataforma
 */
export function getAdapter(platform: ExternalPlatform): SourceAdapter | null {
  const adapters = getAvailableAdapters();
  return adapters.find(a => a.platform === platform && a.enabled) ?? null;
}