import { supabase } from './client';

type PublicationRow = {
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
  age_approx: string | null;
  published_at: string;
  resolved_at: string | null;
  contact_mode?: 'INTERNAL' | 'PHONE' | 'WHATSAPP' | 'EMAIL';
  contact_phone?: string | null;
  contact_whatsapp?: string | null;
  contact_email?: string | null;
  reward?: string | null;
  event_date?: string | null;
  event_time_approx?: string | null;
  is_imported?: boolean;
  source_platform?: string | null;
  source_url?: string | null;
  import_review_status?: string | null;
  microchip?: string | null;
  location:
    | {
        province: string;
        municipality: string;
        zone: string | null;
        approximate_lat: number | null;
        approximate_lng: number | null;
      }
    | Array<{
        province: string;
        municipality: string;
        zone: string | null;
        approximate_lat: number | null;
        approximate_lng: number | null;
      }>
    | null;
  publication_images: Array<{
    storage_path: string;
    is_cover: boolean;
    alt_text: string | null;
  }>;
  owner?: { username: string } | null;
  owner_profile_id?: string;
};

export type PublicationSummary = {
  id: string;
  slug: string;
  title: string;
  description: string;
  type: PublicationRow['type'];
  status: PublicationRow['status'];
  species: string;
  breed: string | null;
  color: string | null;
  sex: string | null;
  size: string | null;
  ageApprox: string | null;
  publishedAt: string;
  resolvedAt: string | null;
  province: string | null;
  municipality: string | null;
  zone: string | null;
  approximateLat: number | null;
  approximateLng: number | null;
  coverImageUrl: string | null;
  distance?: number; // Distancia calculada en km (opcional)
};

export type SearchFilters = {
  query?: string;
  type?: PublicationRow['type'] | 'ALL';
  species?: string;
  sex?: string;
  size?: string;
  age?: string;
  province?: string;
  municipality?: string;
  zone?: string;
  status?: PublicationRow['status'] | 'ALL';
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapPublication(row: any): PublicationSummary {
  const cover = row.publication_images?.find((image: { is_cover: boolean }) => image.is_cover) ?? row.publication_images?.[0] ?? null;

  // Normalizar location: puede ser objeto o array[0]
  const location = Array.isArray(row.location) ? row.location[0] : row.location;

  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    type: row.type,
    status: row.status,
    species: row.species,
    breed: row.breed,
    color: row.color,
    sex: row.sex,
    size: row.size,
    ageApprox: row.age_approx ?? null,
    publishedAt: row.published_at,
    resolvedAt: row.resolved_at ?? null,
    province: location?.province ?? null,
    municipality: location?.municipality ?? null,
    zone: location?.zone ?? null,
    approximateLat: location?.approximate_lat ?? null,
    approximateLng: location?.approximate_lng ?? null,
    coverImageUrl: cover ? supabase.storage.from('pet-images').getPublicUrl(cover.storage_path).data.publicUrl : null,
  };
}

export async function searchPublications(filters: SearchFilters) {
  const limit = filters.limit ?? 48;
  const offset = filters.offset ?? 0;

  // Si hay query de texto, intentar usar la función optimizada con FTS
  if (filters.query && filters.query.trim().length > 2) {
    try {
      const { data: ftsResults, error: ftsError } = await supabase.rpc('search_publications', {
        search_query: filters.query.trim(),
        filter_type: filters.type && filters.type !== 'ALL' ? filters.type : null,
        filter_species: filters.species || null,
        filter_sex: filters.sex || null,
        filter_size: filters.size || null,
        // `null` en status significa "todos": el filtro SQL solo se aplica cuando
        // llega un valor. Antes, elegir "Todos" con texto forzaba ACTIVE y ocultaba
        // los casos resueltos.
        filter_status: filters.status === 'ALL' ? null : filters.status || 'ACTIVE',
        filter_province: filters.province || null,
        filter_municipality: filters.municipality || null,
        filter_age: filters.age || null,
        filter_zone: filters.zone || null,
        since_date: filters.since || null,
        until_date: filters.until || null,
        result_limit: limit,
        result_offset: offset,
      });

      if (!ftsError && ftsResults) {
        // Obtener imágenes para cada resultado
        const ids = ftsResults.map((r: { id: string }) => r.id);
        const { data: withImages, error: imgError } = await supabase
          .from('publications')
          .select('id, location:locations(province, municipality, zone, approximate_lat, approximate_lng), publication_images(storage_path, is_cover, alt_text)')
          .in('id', ids);

        if (!imgError && withImages) {
          // Type assertion para tratar la ubicación como objeto único (relación 1:1)
          const typedWithImages = withImages as unknown as Array<{
            id: string;
            location: {
              province: string;
              municipality: string;
              zone: string | null;
              approximate_lat: number | null;
              approximate_lng: number | null;
            } | null;
            publication_images: Array<{
              storage_path: string;
              is_cover: boolean;
              alt_text: string | null;
            }> | null;
          }>;
          // Combinar resultados FTS con imágenes
          return ftsResults.map((fts: {
            id: string;
            slug: string;
            title: string;
            description: string;
            type: string;
            status: string;
            species: string;
            breed: string | null;
            sex: string | null;
            size: string | null;
            color: string;
            age_approx: string | null;
            published_at: string;
            resolved_at: string | null;
          }) => {
            const withImg = typedWithImages.find((w) => w.id === fts.id);
            
            const cover = withImg?.publication_images?.find((img) => img.is_cover) ?? 
                         withImg?.publication_images?.[0] ?? null;
            
            return {
              id: fts.id,
              slug: fts.slug,
              title: fts.title,
              description: fts.description,
              type: fts.type as PublicationRow['type'],
              status: fts.status as PublicationRow['status'],
              species: fts.species,
              breed: fts.breed,
              color: fts.color,
              sex: fts.sex,
              size: fts.size,
              ageApprox: fts.age_approx ?? null,
              publishedAt: fts.published_at,
              resolvedAt: fts.resolved_at ?? null,
              province: withImg?.location?.province ?? null,
              municipality: withImg?.location?.municipality ?? null,
              zone: withImg?.location?.zone ?? null,
              approximateLat: withImg?.location?.approximate_lat ?? null,
              approximateLng: withImg?.location?.approximate_lng ?? null,
              coverImageUrl: cover ? supabase.storage.from('pet-images').getPublicUrl(cover.storage_path).data.publicUrl : null,
            };
          });
        }
      }
    } catch (err) {
      // Fallback a búsqueda básica si FTS falla
      console.warn('FTS search fallback:', err);
    }
  }

  // Búsqueda básica (fallback o sin query de texto)
  // `!inner` solo cuando se filtra por ubicación: sin filtro el join debe ser LEFT,
  // porque hay publicaciones reales sin ubicación que deben seguir apareciendo.
  const locationJoin =
    filters.province || filters.municipality || filters.zone ? 'locations!inner' : 'locations';
  let query = supabase
    .from('publications')
    .select(`id, slug, title, description, type, status, species, breed, color, sex, size, age_approx, published_at, resolved_at, location:${locationJoin}(province, municipality, zone, approximate_lat, approximate_lng), publication_images(storage_path, is_cover, alt_text)`)
    .neq('status', 'DELETED')
    .order('published_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (filters.type && filters.type !== 'ALL') {
    query = query.eq('type', filters.type);
  }

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  if (filters.province) {
    query = query.eq('location.province', filters.province);
  }

  if (filters.municipality) {
    query = query.eq('location.municipality', filters.municipality);
  }

  if (filters.species) {
    query = query.eq('species', filters.species);
  }

  if (filters.sex) {
    query = query.eq('sex', filters.sex);
  }

  if (filters.size) {
    query = query.eq('size', filters.size);
  }

  if (filters.age) {
    query = query.eq('age_approx', filters.age);
  }

  if (filters.zone) {
    query = query.ilike('location.zone', `%${filters.zone.trim()}%`);
  }

  if (filters.since) {
    query = query.gte('published_at', filters.since);
  }

  if (filters.until) {
    // `until` es una fecha inclusiva: se compara contra el inicio del día
    // siguiente para incluir todo el día elegido.
    const untilExclusive = new Date(`${filters.until}T00:00:00Z`);
    untilExclusive.setUTCDate(untilExclusive.getUTCDate() + 1);
    query = query.lt('published_at', untilExclusive.toISOString());
  }

  if (filters.query) {
    const normalized = filters.query.trim();

    if (normalized.length > 1) {
      query = query.or(
        [
          `title.ilike.%${normalized}%`,
          `description.ilike.%${normalized}%`,
          `species.ilike.%${normalized}%`,
          `breed.ilike.%${normalized}%`,
          `color.ilike.%${normalized}%`,
        ].join(',')
      );
    }
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  if (!data) {
    return [];
  }

  const mapped = data.map(mapPublication);

  return mapped;
}

export async function countPublications(filters: SearchFilters): Promise<number> {
  let query = supabase
    .from('publications')
    .select('id', { count: 'exact', head: true })
    .neq('status', 'DELETED');

  if (filters.type && filters.type !== 'ALL') {
    query = query.eq('type', filters.type);
  }

  if (filters.status && filters.status !== 'ALL') {
    query = query.eq('status', filters.status);
  }

  if (filters.province) {
    query = query.eq('location.province', filters.province);
  }

  if (filters.municipality) {
    query = query.eq('location.municipality', filters.municipality);
  }

  if (filters.species) {
    query = query.eq('species', filters.species);
  }

  if (filters.sex) {
    query = query.eq('sex', filters.sex);
  }

  if (filters.size) {
    query = query.eq('size', filters.size);
  }

  if (filters.age) {
    query = query.eq('age_approx', filters.age);
  }

  if (filters.zone) {
    query = query.ilike('location.zone', `%${filters.zone.trim()}%`);
  }

  if (filters.since) {
    query = query.gte('published_at', filters.since);
  }

  if (filters.until) {
    const untilExclusive = new Date(`${filters.until}T00:00:00Z`);
    untilExclusive.setUTCDate(untilExclusive.getUTCDate() + 1);
    query = query.lt('published_at', untilExclusive.toISOString());
  }

  if (filters.query) {
    const normalized = filters.query.trim();

    if (normalized.length > 1) {
      query = query.or(
        [
          `title.ilike.%${normalized}%`,
          `description.ilike.%${normalized}%`,
          `species.ilike.%${normalized}%`,
          `breed.ilike.%${normalized}%`,
          `color.ilike.%${normalized}%`,
        ].join(',')
      );
    }
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

/**
 * Finales felices para la portada.
 *
 * Se apoya en el estado `RESOLVED`, que ya es visible para cualquiera según la
 * política RLS de `publications`. El orden usa `resolved_at` (cuándo terminó la
 * historia) y cae a `published_at` para filas antiguas sin esa fecha.
 */
export async function getSuccessStories(limit = 6): Promise<PublicationSummary[]> {
  const { data, error } = await supabase
    .from('publications')
    .select(`id, slug, title, description, type, status, species, breed, color, sex, size, age_approx, published_at, resolved_at, location:locations(province, municipality, zone, approximate_lat, approximate_lng), publication_images(storage_path, is_cover, alt_text)`)
    .eq('status', 'RESOLVED')
    .is('deleted_at', null)
    .order('resolved_at', { ascending: false, nullsFirst: false })
    .order('published_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data ?? []).map(mapPublication);
}

export async function getPublicationBySlug(slug: string) {
  const { data, error } = await supabase
    .from('publications')
    .select(`
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
      age_approx,
      characteristics,
      published_at, 
      resolved_at,
      reward, 
      event_date, 
      event_time_approx, 
      owner_profile_id,
      owner:profiles!owner_profile_id(username),
      location:locations(province, municipality, zone, approximate_lat, approximate_lng), 
      publication_images(storage_path, is_cover, alt_text)
    `)
    .eq('slug', slug)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as
    | (PublicationRow & {
        age_approx: string | null;
        characteristics: string | null;
        reward: string | null;
        event_date: string | null;
        event_time_approx: string | null;
        owner_profile_id: string | null;
        owner: { username: string } | null;
      })
    | null;
}
/**
 * Publicación completa para el formulario de edición.
 *
 * NO incluye las columnas de contacto ni el microchip: desde la migración 0014 no
 * tienen permisos de columna para `authenticated`. Los datos de contacto se piden
 * aparte con `getPublicationContact()`, que es el único camino autorizado.
 *
 * También se elimina `microchip`: esa columna no existe en `publications` (solo
 * `pets.microchip_private`), así que la consulta fallaba entera en PostgREST.
 */
export async function getPublicationById(id: string) {
  const { data, error } = await supabase
    .from('publications')
    .select(`
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
      age_approx,
      characteristics,
      published_at, 
      resolved_at,
      reward, 
      event_date, 
      event_time_approx, 
      is_imported,
      source_platform,
      source_url,
      import_review_status,
      owner_profile_id,
      owner:profiles!owner_profile_id(username),
      location:locations(province, municipality, zone, approximate_lat, approximate_lng), 
      publication_images(storage_path, is_cover, alt_text)
    `)
    .eq('id', id)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data as
    | (PublicationRow & {
        age_approx: string | null;
        characteristics: string | null;
        reward: string | null;
        event_date: string | null;
        event_time_approx: string | null;
        is_imported: boolean | null;
        source_platform: string | null;
        source_url: string | null;
        import_review_status: string | null;
        owner_profile_id: string | null;
        owner: { username: string } | null;
      })
    | null;
}

export type PublicationContact = {
  contact_phone: string | null;
  contact_whatsapp: string | null;
  contact_email: string | null;
  contact_mode: 'INTERNAL' | 'PHONE' | 'WHATSAPP' | 'EMAIL';
};

/**
 * Obtiene los datos de contacto de una publicación.
 *
 * Pasa por `reveal_publication_contact()`, no por un SELECT: esa función es la que
 * decide si el usuario puede verlos (dueño o moderador, o cuota de 30 cada 24 h
 * con registro en `contact_reveals`). Devuelve `null` si no hay permiso o se
 * agotó la cuota, en lugar de lanzar: la UI muestra "contacto no disponible".
 */
export async function getPublicationContact(
  publicationId: string
): Promise<PublicationContact | null> {
  const { data, error } = await supabase.rpc('reveal_publication_contact', {
    p_publication_id: publicationId,
  });

  if (error) {
    // 53400 = cuota agotada; 42501 = sin permiso o publicación no visible.
    console.warn('[contacto] no se pudo revelar el contacto:', error.message);
    return null;
  }

  const row = Array.isArray(data) ? data[0] : data;

  if (!row) return null;

  return {
    contact_phone: row.contact_phone ?? null,
    contact_whatsapp: row.contact_whatsapp ?? null,
    contact_email: row.contact_email ?? null,
    contact_mode: row.contact_mode ?? 'INTERNAL',
  };
}