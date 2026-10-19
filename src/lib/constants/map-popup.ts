/**
 * Metadatos centralizados para tipos de publicación en el popup del mapa.
 * Unifica colores, etiquetas y estilos usados por marcadores y popups.
 */
export const POST_TYPE_META: Record<
  'LOST' | 'FOUND' | 'ABANDONED' | 'ADOPTION' | 'SIGHTING',
  {
    label: string;
    stroke: string; // color del borde del marcador / punto del chip
    chipBg: string; // fondo del chip (stroke a ~15% opacidad)
    chipText: string; // texto del chip (versión oscurecida para contraste 4.5:1)
  }
> = {
  LOST: {
    label: 'Perdida',
    stroke: '#ef4444',
    chipBg: 'rgba(239,68,68,0.15)',
    chipText: '#9f1d22',
  },
  FOUND: {
    label: 'Encontrada',
    stroke: '#10b981',
    chipBg: 'rgba(16,185,129,0.15)',
    chipText: '#065f46',
  },
  ABANDONED: {
    label: 'Abandonada',
    stroke: '#ff8c42',
    chipBg: 'rgba(255,140,66,0.15)',
    chipText: '#8a3f08',
  },
  ADOPTION: {
    label: 'En adopción',
    stroke: '#a78bfa',
    chipBg: 'rgba(167,139,250,0.15)',
    chipText: '#4c2fa3',
  },
  SIGHTING: {
    label: 'Avistamiento',
    stroke: '#ffb078',
    chipBg: 'rgba(255,176,120,0.20)',
    chipText: '#7a3d0a',
  },
} as const;

/**
 * Metadatos para estados de publicación en el popup del mapa.
 * HIDDEN y DELETED no se renderizan en el mapa.
 */
export const POST_STATUS_META: Record<
  'ACTIVE' | 'RESOLVED' | 'EXPIRED',
  {
    label: string;
    bg: string;
    text: string;
  }
> = {
  ACTIVE: {
    label: 'Activa',
    bg: '#dcf5e4',
    text: '#14633a',
  },
  RESOLVED: {
    label: 'Resuelta',
    bg: '#e6edf5',
    text: '#2b4a6b',
  },
  EXPIRED: {
    label: 'Expirada',
    bg: '#efe9e4',
    text: '#5b4636',
  },
} as const;

export type PostType = keyof typeof POST_TYPE_META;
export type PostStatus = keyof typeof POST_STATUS_META;

/**
 * Verifica si un estado debe renderizarse en el popup del mapa.
 */
export function shouldRenderStatus(status: string): status is PostStatus {
  return status in POST_STATUS_META;
}

/**
 * Verifica si un tipo es válido.
 */
export function isValidPostType(type: string): type is PostType {
  return type in POST_TYPE_META;
}