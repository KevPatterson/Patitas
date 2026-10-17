import { supabase } from './client';
type CreateLocationInput = {
  province: string;
  municipality: string;
  zone?: string;
  approximateLat?: string;
  approximateLng?: string;
};

type CreatePublicationInput = {
  ownerProfileId: string;
  slug: string;
  locationId: string | null;
  petId?: string | null;
  type: 'LOST' | 'FOUND' | 'ABANDONED' | 'ADOPTION' | 'SIGHTING';
  title: string;
  description: string;
  species: string;
  breed?: string;
  sex?: string;
  size?: string;
  ageApprox?: string;
  color: string;
  characteristics?: string;
  collar: boolean;
  plate: boolean;
  reward?: string;
  contactMode: 'INTERNAL' | 'PHONE' | 'WHATSAPP' | 'EMAIL';
  contactPhone?: string;
  contactWhatsapp?: string;
  contactEmail?: string;
  eventDate?: string;
  eventTimeApprox?: string;
  // Campos de importación (Módulo B - Facebook Import)
  isImported?: boolean;
  sourcePlatform?: 'TELEGRAM' | 'FACEBOOK_PUBLIC';
  sourceUrl?: string;
  importReviewStatus?: 'AUTO_APPROVED' | 'MANUAL_APPROVED' | 'REJECTED';
};

export async function createLocation(input: CreateLocationInput) {
  const { data, error } = await supabase
    .from('locations')
    .insert({
      province: input.province,
      municipality: input.municipality,
      zone: input.zone || null,
      approximate_lat: input.approximateLat ? Number(input.approximateLat) : null,
      approximate_lng: input.approximateLng ? Number(input.approximateLng) : null,
    })
    .select('id')
    .single();

  if (error) {
    throw error;
  }

  return data.id as string;
}

export async function createPet(input: {
  ownerProfileId: string;
  species: string;
  breed?: string;
  sex?: string;
  size?: string;
  ageApprox?: string;
  color?: string;
  characteristics?: string;
  collar?: boolean;
  plate?: boolean;
  microchip?: string;
}) {
  const { data, error } = await supabase
    .from('pets')
    .insert({
      owner_profile_id: input.ownerProfileId,
      species: input.species,
      breed: input.breed || null,
      sex: input.sex || null,
      size: input.size || null,
      age_approx: input.ageApprox || null,
      color: input.color || null,
      characteristics: input.characteristics || null,
      has_collar: input.collar ?? false,
      has_plate: input.plate ?? false,
      microchip_private: input.microchip || null,
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id as string;
}

export async function createPublication(input: CreatePublicationInput) {
  const { data, error } = await supabase
    .from('publications')
    .insert({
      owner_profile_id: input.ownerProfileId,
      slug: input.slug,
      location_id: input.locationId,
      pet_id: input.petId ?? null,
      type: input.type,
      title: input.title,
      description: input.description,
      species: input.species,
      breed: input.breed || null,
      sex: input.sex || null,
      size: input.size || null,
      age_approx: input.ageApprox || null,
      color: input.color,
      characteristics: input.characteristics || null,
      collar: input.collar,
      plate: input.plate,
      reward: input.reward || null,
      contact_mode: input.contactMode,
      contact_phone: input.contactPhone || null,
      contact_whatsapp: input.contactWhatsapp || null,
      contact_email: input.contactEmail || null,
      event_date: input.eventDate || null,
      event_time_approx: input.eventTimeApprox || null,
      // Campos de importación
      is_imported: input.isImported ?? false,
      source_platform: input.sourcePlatform ?? null,
      source_url: input.sourceUrl ?? null,
      import_review_status: input.importReviewStatus ?? 'MANUAL_APPROVED',
    })
    .select('id, slug')
    .single();

  if (error) {
    throw error;
  }

  return data;
}
// La subida y el borrado de imágenes viven en su propio módulo porque ahora pasan
// por /api/uploads (el cliente ya no escribe en Storage, ver migración 0014).
export {
  uploadPublicationImages,
  deletePublicationImages,
  type UploadProgress,
  type UploadedImage,
} from './publication-images';