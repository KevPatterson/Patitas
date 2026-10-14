export type PublicationType = 'LOST' | 'FOUND' | 'ABANDONED' | 'ADOPTION' | 'SIGHTING';

export type PublicationStatus = 'ACTIVE' | 'RESOLVED' | 'EXPIRED' | 'HIDDEN' | 'DELETED';

// ============================================================================
// Fuentes externas (Telegram, Facebook público)
// ============================================================================

export type ExternalPlatform = 'TELEGRAM' | 'FACEBOOK_PUBLIC';

export type ExternalPostStatus =
  | 'NEW'
  | 'PROCESSING'
  | 'NOT_RELEVANT'
  | 'DUPLICATE'
  | 'PENDING_REVIEW'
  | 'PUBLISHED'
  | 'REJECTED'
  | 'TAKEN_DOWN';

export type TakedownStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type TakedownReason = 'COPYRIGHT' | 'PRIVACY' | 'INACCURATE' | 'OTHER';

export type ImportReviewStatus = 'AUTO_APPROVED' | 'MANUAL_APPROVED' | 'REJECTED';

export interface ExternalSource {
  id: string;
  platform: ExternalPlatform;
  handle_or_url: string;
  name: string | null;
  province: string | null;
  is_active: boolean;
  is_trusted: boolean;
  last_cursor: string | null;
  last_run_at: string | null;
  error_count: number;
  created_at: string;
  updated_at: string;
}

export interface ExternalPost {
  id: string;
  source_id: string;
  platform: ExternalPlatform;
  external_id: string;
  source_url: string;
  raw_text: string | null;
  image_paths: string[];
  posted_at: string;
  fetched_at: string;
  status: ExternalPostStatus;
  confidence: number;
  extracted: Record<string, unknown>;
  publication_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface TakedownRequest {
  id: string;
  publication_id: string;
  reason: TakedownReason;
  contact_email: string | null;
  status: TakedownStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
  updated_at: string;
}

// Extensión de Publication para campos de importación
export interface ImportedPublicationFields {
  is_imported: boolean;
  source_platform: ExternalPlatform | null;
  source_url: string | null;
  import_review_status: ImportReviewStatus | null;
}

// ============================================================================
// Payloads para API de ingesta
// ============================================================================

export interface IngestExternalPostPayload {
  source_id: string;
  platform: ExternalPlatform;
  external_id: string;
  source_url: string;
  raw_text: string | null;
  image_paths: string[];
  posted_at: string;
  // HMAC para autenticación del worker
  timestamp: number;
  signature: string;
}

export interface IngestResponse {
  external_post_id: string;
  status: ExternalPostStatus;
  confidence: number;
  publication_id?: string;
  duplicate_of?: string;
  message: string;
}

// ============================================================================
// Facebook Import (Módulo B)
// ============================================================================

export interface FacebookLinkImportRequest {
  url: string;
}

export interface FacebookLinkImportResponse {
  success: boolean;
  data?: {
    title: string | null;
    description: string | null;
    image_url: string | null;
    // Datos extraídos por IA si se procesa
    extracted?: Record<string, unknown>;
    confidence?: number;
  };
  error?: string;
  suggestion?: 'UPLOAD_SCREENSHOT';
}

export interface FacebookScreenshotImportRequest {
  image_file: File; // Se maneja via FormData
}

export interface ExtractedPublicationData {
  type?: PublicationType;
  title?: string;
  description?: string;
  species?: string;
  breed?: string;
  sex?: string;
  size?: string;
  age_approx?: string;
  color?: string;
  characteristics?: string;
  collar?: boolean;
  plate?: boolean;
  reward?: string;
  contact_mode?: 'INTERNAL' | 'PHONE' | 'WHATSAPP' | 'EMAIL';
  contact_phone?: string;
  contact_whatsapp?: string;
  contact_email?: string;
  province?: string;
  municipality?: string;
  zone?: string;
  event_date?: string;
  event_time_approx?: string;
  confidence: Record<string, number>; // confidence por campo 0-1
  source_url?: string;
}