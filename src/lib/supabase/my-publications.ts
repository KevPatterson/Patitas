import { supabase } from './client';
import { getUser } from './auth';

export type MyPublication = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: 'LOST' | 'FOUND' | 'ABANDONED' | 'ADOPTION' | 'SIGHTING';
  status: 'ACTIVE' | 'RESOLVED' | 'EXPIRED' | 'HIDDEN' | 'DELETED';
  species: string;
  breed: string | null;
  color: string | null;
  sex: string | null;
  size: string | null;
  published_at: string;
  resolved_at: string | null;
  coverImageUrl: string | null;
  province?: string | null;
  municipality?: string | null;
  zone?: string | null;
  approximateLat?: number | null;
  approximateLng?: number | null;
  adoption_requests_count?: number;
  comments_count?: number;
  sightings_count?: number;
};

export async function getMyPublications(): Promise<MyPublication[]> {
  const user = await getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('publications')
    .select(
      `
      id,
      slug,
      title,
      description,
      type,
      status,
      species,
      breed,
      color,
      sex,
      size,
      published_at,
      resolved_at,
      publication_images(storage_path, is_cover, alt_text),
      location:locations(province, municipality, zone, approximate_lat, approximate_lng)
    `
    )
    .eq('owner_profile_id', user.id)
    // Las eliminadas (soft delete) siguen existiendo para RLS del dueño, pero no
    // deben reaparecer en el panel al recargar.
    .neq('status', 'DELETED')
    .order('published_at', { ascending: false });

  if (error) {
    throw error;
  }

  return (
    data?.map((pub) => {
      const cover =
        pub.publication_images?.find((img: { is_cover: boolean }) => img.is_cover) ?? 
        pub.publication_images?.[0] ?? 
        null;
      
      const location = Array.isArray(pub.location) ? pub.location[0] : pub.location;

      return {
        id: pub.id,
        slug: pub.slug,
        title: pub.title,
        description: pub.description,
        type: pub.type,
        status: pub.status,
        species: pub.species,
        breed: pub.breed,
        color: pub.color,
        sex: pub.sex,
        size: pub.size,
        published_at: pub.published_at,
        resolved_at: pub.resolved_at,
        province: location?.province ?? null,
        municipality: location?.municipality ?? null,
        zone: location?.zone ?? null,
        approximateLat: location?.approximate_lat ?? null,
        approximateLng: location?.approximate_lng ?? null,
        coverImageUrl: cover
          ? supabase.storage.from('pet-images').getPublicUrl(cover.storage_path).data.publicUrl
          : null,
      };
    }) || []
  );
}

export async function getMyPublicationById(publicationId: string) {
  const user = await getUser();
  if (!user) throw new Error('No autenticado');

  const { data, error } = await supabase
    .from('publications')
    .select(
      `
      *,
      location:locations(*),
      pet:pets(*),
      publication_images(*)
    `
    )
    .eq('id', publicationId)
    .eq('owner_profile_id', user.id)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function updatePublication(
  publicationId: string,
  updates: {
    title?: string;
    description?: string;
    species?: string;
    breed?: string;
    sex?: string;
    size?: string;
    ageApprox?: string;
    color?: string;
    characteristics?: string;
    collar?: boolean;
    plate?: boolean;
    reward?: string;
    contactMode?: 'INTERNAL' | 'PHONE' | 'WHATSAPP' | 'EMAIL';
    contactPhone?: string;
    contactWhatsapp?: string;
    contactEmail?: string;
    type?: 'LOST' | 'FOUND' | 'ABANDONED' | 'ADOPTION' | 'SIGHTING';
    eventDate?: string;
    eventTimeApprox?: string;
    province?: string;
    municipality?: string;
    zone?: string;
    approximateLat?: string;
    approximateLng?: string;
  }
) {
  const user = await getUser();
  if (!user) throw new Error('No autenticado');

  const updateData: Record<string, unknown> = {};

  if (updates.title !== undefined) updateData.title = updates.title;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.species !== undefined) updateData.species = updates.species;
  if (updates.breed !== undefined) updateData.breed = updates.breed || null;
  if (updates.sex !== undefined) updateData.sex = updates.sex || null;
  if (updates.size !== undefined) updateData.size = updates.size || null;
  if (updates.ageApprox !== undefined) updateData.age_approx = updates.ageApprox || null;
  if (updates.color !== undefined) updateData.color = updates.color;
  if (updates.characteristics !== undefined)
    updateData.characteristics = updates.characteristics || null;
  if (updates.collar !== undefined) updateData.collar = updates.collar;
  if (updates.plate !== undefined) updateData.plate = updates.plate;
  if (updates.reward !== undefined) updateData.reward = updates.reward || null;
  if (updates.contactMode !== undefined) updateData.contact_mode = updates.contactMode;
  if (updates.contactPhone !== undefined) updateData.contact_phone = updates.contactPhone || null;
  if (updates.contactWhatsapp !== undefined)
    updateData.contact_whatsapp = updates.contactWhatsapp || null;
  if (updates.contactEmail !== undefined) updateData.contact_email = updates.contactEmail || null;
  if (updates.type !== undefined) updateData.type = updates.type;
  if (updates.eventDate !== undefined) updateData.event_date = updates.eventDate || null;
  if (updates.eventTimeApprox !== undefined) updateData.event_time_approx = updates.eventTimeApprox || null;

  const { data, error } = await supabase
    .from('publications')
    .update(updateData)
    .eq('id', publicationId)
    .eq('owner_profile_id', user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  // Actualizar ubicación si se proporcionaron campos de ubicación
  if (
    updates.province !== undefined ||
    updates.municipality !== undefined ||
    updates.zone !== undefined ||
    updates.approximateLat !== undefined ||
    updates.approximateLng !== undefined
  ) {
    const { data: pub } = await supabase
      .from('publications')
      .select('location_id')
      .eq('id', publicationId)
      .single();

    if (pub?.location_id) {
      const locationUpdate: Record<string, unknown> = {};
      if (updates.province !== undefined) locationUpdate.province = updates.province;
      if (updates.municipality !== undefined) locationUpdate.municipality = updates.municipality;
      if (updates.zone !== undefined) locationUpdate.zone = updates.zone || null;
      if (updates.approximateLat !== undefined)
        locationUpdate.approximate_lat = updates.approximateLat ? Number(updates.approximateLat) : null;
      if (updates.approximateLng !== undefined)
        locationUpdate.approximate_lng = updates.approximateLng ? Number(updates.approximateLng) : null;

      const { error: locationError } = await supabase
        .from('locations')
        .update(locationUpdate)
        .eq('id', pub.location_id);

      if (locationError) {
        throw locationError;
      }
    } else if (updates.province && updates.municipality) {
      // Crear nueva ubicación si no existe
      const { data: newLocation, error: locationError } = await supabase
        .from('locations')
        .insert({
          province: updates.province,
          municipality: updates.municipality,
          zone: updates.zone || null,
          approximate_lat: updates.approximateLat ? Number(updates.approximateLat) : null,
          approximate_lng: updates.approximateLng ? Number(updates.approximateLng) : null,
        })
        .select('id')
        .single();

      if (locationError) {
        throw locationError;
      }

      const { error: pubError } = await supabase
        .from('publications')
        .update({ location_id: newLocation.id })
        .eq('id', publicationId)
        .eq('owner_profile_id', user.id);

      if (pubError) {
        throw pubError;
      }
    }
  }

  return data;
}

export async function getPublicationStats(userId: string) {
  const [totalResult, activeResult, resolvedResult] = await Promise.all([
    supabase
      .from('publications')
      .select('id', { count: 'exact', head: true })
      .eq('owner_profile_id', userId)
      .neq('status', 'DELETED'),

    supabase
      .from('publications')
      .select('id', { count: 'exact', head: true })
      .eq('owner_profile_id', userId)
      .eq('status', 'ACTIVE'),

    supabase
      .from('publications')
      .select('id', { count: 'exact', head: true })
      .eq('owner_profile_id', userId)
      .eq('status', 'RESOLVED'),
  ]);

  return {
    total: totalResult.count ?? 0,
    active: activeResult.count ?? 0,
    resolved: resolvedResult.count ?? 0,
  };
}
