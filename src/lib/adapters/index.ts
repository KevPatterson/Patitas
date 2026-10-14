/**
 * Exportaciones públicas del sistema de adaptadores de fuentes externas.
 */

// Tipos y factory desde source-adapter
export type { SourceAdapter, RawPost, SourceConfig, FetchResult } from './source-adapter';
export { getAdapter } from './source-adapter';

// Implementaciones concretas
export { FacebookPublicAdapter, facebookPublicAdapter, fetchFacebookPublicPosts } from './facebook-public-adapter';