import { supabase } from './client';

export async function resolvePublication(publicationId: string, userId: string) {
  const { error } = await supabase
    .from('publications')
    .update({
      status: 'RESOLVED',
      resolved_at: new Date().toISOString(),
    })
    .eq('id', publicationId)
    .eq('owner_profile_id', userId);

  if (error) {
    throw error;
  }
}

export async function hidePublication(publicationId: string, userId: string) {
  const { error } = await supabase
    .from('publications')
    .update({
      status: 'HIDDEN',
    })
    .eq('id', publicationId)
    .eq('owner_profile_id', userId);

  if (error) {
    throw error;
  }
}

export async function deletePublication(publicationId: string, userId: string) {
  const { error } = await supabase
    .from('publications')
    .update({
      status: 'DELETED',
      deleted_at: new Date().toISOString(),
    })
    .eq('id', publicationId)
    .eq('owner_profile_id', userId);

  if (error) {
    console.error('[deletePublication] Error:', {
      publicationId,
      userId,
      code: error.code,
      message: error.message,
      details: error.details,
      hint: error.hint,
    });
    throw new Error(`Error eliminando publicación: ${error.message}`);
  }
}

export async function createSighting(input: {
  publicationId: string;
  reporterProfileId: string | null;
  note: string;
  locationId?: string;
  occurredAt?: string;
}) {
  const { data, error } = await supabase
    .from('sightings')
    .insert({
      publication_id: input.publicationId,
      reporter_profile_id: input.reporterProfileId ?? null,
      note: input.note,
      location_id: input.locationId ?? null,
      occurred_at: input.occurredAt ?? null,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function getSightings(publicationId: string) {
  const { data, error } = await supabase
    .from('sightings')
    .select(`
      id,
      note,
      occurred_at,
      created_at,
      location:locations(province, municipality, zone)
    `)
    .eq('publication_id', publicationId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{
    id: string;
    note: string;
    occurred_at: string | null;
    created_at: string;
    location: { province: string; municipality: string; zone: string | null } | { province: string; municipality: string; zone: string | null }[] | null;
  }>).map((item) => ({
    id: item.id,
    note: item.note,
    occurred_at: item.occurred_at,
    created_at: item.created_at,
    location: Array.isArray(item.location) ? item.location[0] || null : item.location,
  }));
}
