import { supabase } from './client';
import type { User } from '@supabase/supabase-js';

/**
 * Evento global que se dispara cuando el avatar del usuario cambia
 * (subida o eliminación) para que la barra de navegación se actualice.
 */
export const AVATAR_UPDATED_EVENT = 'patitas:avatar-updated';

export function notifyAvatarUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(AVATAR_UPDATED_EVENT));
  }
}

/**
 * Devuelve la URL del avatar proveniente de un proveedor OAuth (Google, etc.).
 * Google expone la foto tanto como `avatar_url` como `picture`.
 */
export function getOAuthAvatarUrl(user: User | null): string | null {
  if (!user) return null;
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const avatar = meta.avatar_url;
  const picture = meta.picture;
  if (typeof avatar === 'string' && avatar.trim() !== '') return avatar;
  if (typeof picture === 'string' && picture.trim() !== '') return picture;
  return null;
}

/**
 * Sincroniza los datos de auth.users hacia profiles de forma no destructiva:
 * - Crea el perfil si no existe (safety net por si el trigger de BD no se aplicó).
 * - Si el perfil no tiene avatar y el usuario tiene uno de Google/OAuth, lo usa por defecto.
 * Nunca sobrescribe un avatar personalizado ya existente.
 */
export async function syncProfileFromAuth(user?: User | null): Promise<void> {
  let effectiveUser = user ?? null;
  if (!effectiveUser) {
    const { data } = await supabase.auth.getUser();
    effectiveUser = data.user ?? null;
  }
  if (!effectiveUser) return;

  const oauthAvatar = getOAuthAvatarUrl(effectiveUser);
  const meta = (effectiveUser.user_metadata ?? {}) as Record<string, unknown>;
  const fullName = typeof meta.full_name === 'string' ? meta.full_name : null;
  const fallbackUsername = effectiveUser.email ? effectiveUser.email.split('@')[0] : 'usuario';

  const { data: existing } = await supabase
    .from('profiles')
    .select('id, avatar_url')
    .eq('id', effectiveUser.id)
    .maybeSingle();

  if (!existing) {
    // El trigger debería haber creado el perfil; lo creamos como respaldo.
    const username = (typeof meta.username === 'string' && meta.username) || fallbackUsername;
    const { error: insertError } = await supabase
      .from('profiles')
      .upsert(
        { id: effectiveUser.id, username, full_name: fullName, avatar_url: oauthAvatar },
        { onConflict: 'id' }
      );
    if (insertError) {
      console.warn('syncProfileFromAuth: no se pudo crear el perfil.', insertError);
    }
    return;
  }

  // Rellenar el avatar de Google/OAuth únicamente si el perfil no tiene uno.
  if (!existing.avatar_url && oauthAvatar) {
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ avatar_url: oauthAvatar })
      .eq('id', effectiveUser.id);
    if (updateError) {
      console.warn('syncProfileFromAuth: no se pudo sincronizar el avatar.', updateError);
    }
  }
}

export async function ensureProfile(username: string, fullName?: string | null) {
  const { data: userResponse, error: userError } = await supabase.auth.getUser();

  if (userError) {
    throw userError;
  }

  const user = userResponse.user;

  if (!user) {
    throw new Error('No hay sesión activa.');
  }

  const { error } = await supabase.from('profiles').upsert({
    id: user.id,
    username,
    full_name: fullName ?? user.user_metadata?.full_name ?? null,
  });

  if (error) {
    throw error;
  }
}

export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio, city, country, created_at')
    .eq('id', userId)
    .is('deleted_at', null)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getProfileByUsername(username: string) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, full_name, avatar_url, bio, city, country, created_at')
    .ilike('username', username)
    .is('deleted_at', null)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getUserPublications(userId: string) {
  const { data, error } = await supabase
    .from('publications')
    .select(
      `
      id,
      slug,
      title,
      type,
      status,
      species,
      published_at,
      publication_images(storage_path, is_cover)
    `
    )
    .eq('owner_profile_id', userId)
    .in('status', ['ACTIVE', 'RESOLVED'])
    .is('deleted_at', null)
    .order('published_at', { ascending: false })
    .limit(20);

  if (error) {
    throw error;
  }

  return (
    data?.map((pub) => {
      const cover = pub.publication_images?.find((img: { is_cover: boolean }) => img.is_cover) ?? 
                   pub.publication_images?.[0] ?? null;

      return {
        id: pub.id,
        slug: pub.slug,
        title: pub.title,
        type: pub.type,
        status: pub.status,
        species: pub.species,
        published_at: pub.published_at,
        coverImageUrl: cover
          ? supabase.storage.from('pet-images').getPublicUrl(cover.storage_path).data.publicUrl
          : null,
      };
    }) || []
  );
}

export async function updateProfile(userId: string, updates: {
  username?: string;
  full_name?: string;
  bio?: string;
  city?: string;
}) {
  const updateData: Record<string, unknown> = {};

  if (updates.username !== undefined) updateData.username = updates.username;
  if (updates.full_name !== undefined) updateData.full_name = updates.full_name;
  if (updates.bio !== undefined) updateData.bio = updates.bio;
  if (updates.city !== undefined) updateData.city = updates.city;

  const { data, error } = await supabase
    .from('profiles')
    .update(updateData)
    .eq('id', userId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function uploadAvatar(userId: string, file: File) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}/avatar.${fileExt}`;

  // Eliminar avatar anterior si existe
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(userId);

  if (existingFiles && existingFiles.length > 0) {
    await supabase.storage
      .from('avatars')
      .remove(existingFiles.map(f => `${userId}/${f.name}`));
  }

  // Subir nuevo avatar
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: true,
    });

  if (uploadError) {
    throw uploadError;
  }

  // Obtener URL pública
  const { data: urlData } = supabase.storage
    .from('avatars')
    .getPublicUrl(fileName);

  const avatarUrl = urlData.publicUrl;

  // Actualizar profile con la nueva URL
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ avatar_url: avatarUrl })
    .eq('id', userId);

  if (updateError) {
    throw updateError;
  }

  return avatarUrl;
}

export async function deleteAvatar(userId: string): Promise<string | null> {
  // Eliminar archivos del storage
  const { data: existingFiles } = await supabase.storage
    .from('avatars')
    .list(userId);

  if (existingFiles && existingFiles.length > 0) {
    await supabase.storage
      .from('avatars')
      .remove(existingFiles.map(f => `${userId}/${f.name}`));
  }

  // Al eliminar la foto personalizada, volvemos a la foto de Google/OAuth
  // (si existe), para que la foto de Google siga siendo el valor por defecto.
  const { data: authData } = await supabase.auth.getUser();
  const oauthAvatar = authData.user ? getOAuthAvatarUrl(authData.user) : null;

  const { error } = await supabase
    .from('profiles')
    .update({ avatar_url: oauthAvatar })
    .eq('id', userId);

  if (error) {
    throw error;
  }

  return oauthAvatar;
}
