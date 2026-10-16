import type { VercelRequest, VercelResponse } from './types/vercel';
import { supabaseAdmin } from './_lib/supabase-admin';
import { checkRateLimit, extractToken, verifyAuth } from './_lib/rate-limit-utils';

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
const MAX_IMAGES_PER_PUBLICATION = 10;

/**
 * Endpoint unificado para publicaciones
 * POST /api/publications?action=<action>
 * 
 * Actions: create, validate-upload
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action as string;

  switch (action) {
    case 'create':
      return handleCreate(req, res);
    case 'validate-upload':
      return handleValidateUpload(req, res);
    default:
      return res.status(400).json({ error: 'Unknown action. Use ?action=create or ?action=validate-upload' });
  }
}

// ============================================================================
// CREATE PUBLICATION
// ============================================================================
async function handleCreate(req: VercelRequest, res: VercelResponse) {
  // Rate limiting: 10 publicaciones por hora
  if (!checkRateLimit(req, res, 'publication-create', 10, 3600_000)) {
    return;
  }

  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);

  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Unauthorized' });
  }

  let payload: Record<string, unknown> = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Validaciones básicas server-side
  if (!payload.title || !payload.description || !payload.type) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // La creación real se hace desde el cliente con RLS
  // Este endpoint sirve principalmente para rate limiting y validación adicional
  return res.status(200).json({ ok: true, message: 'Publication can be created' });
}

// ============================================================================
// VALIDATE UPLOAD
// ============================================================================
async function handleValidateUpload(req: VercelRequest, res: VercelResponse) {
  // Rate limiting: 50 uploads por hora
  if (!checkRateLimit(req, res, 'upload-validate', 50, 3600_000)) {
    return;
  }

  const token = extractToken(req);
  const { user, error: authError } = await verifyAuth(token, supabaseAdmin);

  if (authError || !user) {
    return res.status(401).json({ error: authError || 'Unauthorized' });
  }

  let payload: { publicationId?: string; fileSize?: number; mimeType?: string; count?: number } = {};

  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ error: 'Invalid JSON body' });
  }

  // Validar publicación existe y pertenece al usuario
  if (payload.publicationId) {
    const { data: publication, error: pubError } = await supabaseAdmin
      .from('publications')
      .select('id, owner_profile_id')
      .eq('id', payload.publicationId)
      .is('deleted_at', null)
      .single();

    if (pubError || !publication) {
      return res.status(404).json({ error: 'Publication not found' });
    }

    if (publication.owner_profile_id !== user.id) {
      return res.status(403).json({ error: 'Not authorized to upload to this publication' });
    }

    // Verificar cuántas imágenes ya tiene
    const { count } = await supabaseAdmin
      .from('publication_images')
      .select('id', { count: 'exact', head: true })
      .eq('publication_id', payload.publicationId);

    if (count && count >= MAX_IMAGES_PER_PUBLICATION) {
      return res.status(400).json({ error: `Maximum ${MAX_IMAGES_PER_PUBLICATION} images per publication` });
    }
  }

  // Validar MIME type
  if (payload.mimeType && !ALLOWED_MIME_TYPES.includes(payload.mimeType)) {
    return res.status(400).json({ error: 'Invalid file type. Only JPG, PNG, WebP and GIF allowed' });
  }

  // Validar tamaño
  if (payload.fileSize && payload.fileSize > MAX_FILE_SIZE) {
    return res.status(400).json({ error: 'File too large. Maximum 8MB' });
  }

  return res.status(200).json({ ok: true, message: 'Upload validation passed' });
}
