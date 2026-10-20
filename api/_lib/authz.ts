import { timingSafeEqual } from 'node:crypto';
import type { supabaseAdmin } from './supabase-admin.js';

/**
 * Comparación de cadenas en tiempo constante.
 *
 * Se usa para secretos compartidos (la API key interna). Una comparación normal
 * (`a === b`) corta en el primer byte distinto, así que el tiempo de respuesta
 * filtra cuántos bytes del secreto acertó el atacante (hallazgo API-09).
 */
export function safeEqual(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  // timingSafeEqual exige la misma longitud. Se compara igualmente para no
  // revelar la longitud del secreto por un atajo.
  if (bufferA.length !== bufferB.length) {
    timingSafeEqual(bufferA, bufferA);
    return false;
  }

  return timingSafeEqual(bufferA, bufferB);
}

/**
 * Autorización de recursos: quién puede tocar qué.
 *
 * Todo pasa por la base de datos con el service role, nunca por claims del JWT
 * ni por datos que envíe el cliente. El rol se lee de `profiles` porque
 * `user_metadata` es editable por el propio usuario.
 *
 * Esto cierra los hallazgos API-02, API-03 y API-04: antes, endpoints como
 * `calculate-matches`, `create-match`, `detect-duplicates` y `takedown` no
 * comprobaban la propiedad del recurso.
 */

type Admin = typeof supabaseAdmin;

export type Role = 'USER' | 'MODERATOR' | 'ADMIN';

export type Actor = {
  id: string;
  role: Role;
};

/** Carga el rol real del usuario desde `profiles`. */
export async function getActorRole(admin: Admin, userId: string): Promise<Role | null> {
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle();

  if (error || !data) return null;

  return data.role as Role;
}

export async function getActor(admin: Admin, userId: string): Promise<Actor | null> {
  const role = await getActorRole(admin, userId);
  return role ? { id: userId, role } : null;
}

export function isModerator(actor: Actor | null): boolean {
  return actor?.role === 'MODERATOR' || actor?.role === 'ADMIN';
}

export type PublicationOwnership = {
  id: string;
  ownerProfileId: string | null;
  status: string | null;
  type: string | null;
  slug: string | null;
};

/** Lee la publicación mínima necesaria para autorizar. */
export async function loadPublication(
  admin: Admin,
  publicationId: string
): Promise<PublicationOwnership | null> {
  const { data, error } = await admin
    .from('publications')
    .select('id, owner_profile_id, status, type, slug')
    .eq('id', publicationId)
    .is('deleted_at', null)
    .maybeSingle();

  if (error || !data) return null;

  return {
    id: data.id as string,
    ownerProfileId: (data.owner_profile_id as string | null) ?? null,
    status: (data.status as string | null) ?? null,
    type: (data.type as string | null) ?? null,
    slug: (data.slug as string | null) ?? null,
  };
}

/**
 * ¿Puede `actor` operar sobre esta publicación?
 * Dueño o moderador. Devuelve false si la publicación no tiene dueño.
 */
export function canManagePublication(
  actor: Actor | null,
  publication: PublicationOwnership | null
): boolean {
  if (!actor || !publication) return false;
  if (isModerator(actor)) return true;

  return publication.ownerProfileId === actor.id;
}

/**
 * Comprueba la propiedad de CUALQUIERA de las publicaciones indicadas.
 * Se usa en el flujo de coincidencias, donde el usuario debe ser dueño de A o B.
 */
export async function actorOwnsAnyPublication(
  admin: Admin,
  actor: Actor | null,
  publicationIds: string[]
): Promise<boolean> {
  if (!actor) return false;
  if (isModerator(actor)) return true;

  const { data, error } = await admin
    .from('publications')
    .select('id')
    .in('id', publicationIds)
    .eq('owner_profile_id', actor.id)
    .is('deleted_at', null)
    .limit(1);

  return !error && Array.isArray(data) && data.length > 0;
}

/**
 * Registra una acción en `audit_logs` y devuelve si se pudo escribir.
 *
 * Antes el resultado del insert se ignoraba: si fallaba, la acción se ejecutaba
 * y no quedaba rastro (hallazgo API-01). Ahora el llamante decide qué hacer si
 * la auditoría falla.
 */
export async function writeAuditLog(
  admin: Admin,
  entry: {
    actorProfileId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  const { error } = await admin.from('audit_logs').insert({
    actor_profile_id: entry.actorProfileId,
    action: entry.action,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata ?? {},
  });

  if (error) {
    console.error('[audit] no se pudo registrar la acción', entry.action, error);
    return false;
  }

  return true;
}
