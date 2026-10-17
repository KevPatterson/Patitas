import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Circle, Tag, Globe } from 'lucide-react';
import { useAuth } from '../app/auth-context';
import { Button, LinkButton } from '../components/ui/button';
import { TextField } from '../components/ui/text-field';
import { TextareaField } from '../components/ui/textarea-field';
import { PawLoader } from '../components/ui/paw-loader';
import { ImageDataExtractor } from '../components/ai/image-data-extractor';
import { FacebookImportWizard } from '../components/import/FacebookImportWizard';
import { createLocation, createPublication, uploadPublicationImages, createPet, deletePublicationImages } from '../lib/supabase/publications';
import { isFeatureEnabled } from '../lib/config/feature-flags';
import type { UploadProgress } from '../lib/supabase/publication-images';
import { updatePublication } from '../lib/supabase/my-publications';
import { getPublicationById, getPublicationContact } from '../lib/supabase/publication-search';
import { buildPublicationSlug } from '../lib/utils/slug';
import { publicationFormSchema, type PublicationFormValues } from '../lib/validations/publication';
import { TYPE_LABELS, TYPE_EMOJIS, SPECIES_LABELS, SEX_LABELS, SIZE_LABELS, AGE_LABELS, MAX_IMAGES, MAX_IMAGE_BYTES, ALLOWED_IMAGE_TYPES } from '../lib/constants/labels';
import { CUBA, PROVINCES } from '../lib/constants/cuba';

delete (L.Icon.Default.prototype as unknown as { _getIconUrl?: unknown })._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

function LocationPicker({ onChange }: { onChange: (lat: string, lng: string) => void }) {
  useMapEvents({
    click(e) {
      const { lat, lng } = e.latlng;
      // Difuminación de ±0.0005° (aproximadamente ±50 metros)
      const fuzzLat = lat + (Math.random() - 0.5) * 0.001;
      const fuzzLng = lng + (Math.random() - 0.5) * 0.001;
      console.log('📍 Ubicación seleccionada:', { original: { lat, lng }, difuminada: { fuzzLat, fuzzLng } });
      onChange(fuzzLat.toFixed(6), fuzzLng.toFixed(6));
    },
  });
  return null;
}
export function PublishPage() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const editParam = searchParams.get('edit');
  
  const [step, setStep] = useState(1);
  const [files, setFiles] = useState<File[]>([]);
  const [filePreviews, setFilePreviews] = useState<string[]>([]);
  // Progreso de compresión y subida de imágenes (Fase 3): en conexiones lentas
  // el usuario necesita ver que algo está pasando y poder reintentar.
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const [existingImages, setExistingImages] = useState<Array<{ storage_path: string; is_cover: boolean }>>([]);
  const [originalExistingImages, setOriginalExistingImages] = useState<Array<{ storage_path: string; is_cover: boolean }>>([]);
  const [editingPublicationId, setEditingPublicationId] = useState<string | null>(null);
  const [originalSlug, setOriginalSlug] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [values, setValues] = useState<PublicationFormValues>({
    type: 'LOST',
    title: '',
    description: '',
    species: '',
    breed: '',
    sex: '',
    size: '',
    ageApprox: '',
    color: '',
    characteristics: '',
    collar: false,
    plate: false,
    reward: '',
    contactMode: 'INTERNAL',
    contactPhone: '',
    contactWhatsapp: '',
    contactEmail: '',
    microchip: '',
    province: '',
    municipality: '',
    zone: '',
    approximateLat: '',
    approximateLng: '',
    eventDate: '',
    eventTimeApprox: '',
  });
  const [addressSearch, setAddressSearch] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successSlug, setSuccessSlug] = useState<string | null>(null);
  const [showFacebookImport, setShowFacebookImport] = useState(false);
  const [facebookSourceUrl, setFacebookSourceUrl] = useState<string>('');

  // Cargar datos de publicación existente al editar
  useEffect(() => {
    if (editParam && !isEditing) {
      const loadPublication = async () => {
        try {
          setSubmitting(true);
          const publication = await getPublicationById(editParam);

          if (publication) {
            setEditingPublicationId(publication.id);
            setOriginalSlug(publication.slug);
            setIsEditing(true);

            // Los datos de contacto ya no se pueden leer con un SELECT (migración
            // 0014): se piden a la función autorizada. Para el dueño no consume
            // cuota ni registra revelación.
            const contact = await getPublicationContact(publication.id);

            // Mapear datos de la publicación al formulario
            const location = Array.isArray(publication.location)
              ? publication.location[0] ?? null
              : publication.location ?? null;

            setValues({
              type: publication.type,
              title: publication.title,
              description: publication.description,
              species: publication.species,
              breed: publication.breed ?? '',
              sex: publication.sex ?? '',
              size: publication.size ?? '',
              ageApprox: publication.age_approx ?? '',
              color: publication.color ?? '',
              characteristics: publication.characteristics ?? '',
              collar: false,
              plate: false,
              reward: publication.reward ?? '',
              contactMode: contact?.contact_mode ?? 'INTERNAL',
              contactPhone: contact?.contact_phone ?? '',
              contactWhatsapp: contact?.contact_whatsapp ?? '',
              contactEmail: contact?.contact_email ?? '',
              microchip: '',
              province: location?.province ?? '',
              municipality: location?.municipality ?? '',
              zone: location?.zone ?? '',
              approximateLat: '',
              approximateLng: '',
              eventDate: publication.event_date ?? '',
              eventTimeApprox: '',
            });

            setExistingImages(
              (publication.publication_images ?? []).map((img) => ({
                storage_path: img.storage_path,
                is_cover: img.is_cover,
              }))
            );
            setOriginalExistingImages(
              (publication.publication_images ?? []).map((img) => ({
                storage_path: img.storage_path,
                is_cover: img.is_cover,
              }))
            );

            if (publication.publication_images && publication.publication_images.length > 0) {
              const coverImage = publication.publication_images.find((img) => img.is_cover);
              if (coverImage) {
                setFilePreviews([coverImage.storage_path]);
              }
            }
          }
        } catch (error) {
          console.error('Error loading publication for edit:', error);
          setErrorMessage('No se pudo cargar la publicación para editar.');
        } finally {
          setSubmitting(false);
        }
      };

      loadPublication();
    }
  }, [editParam, isEditing]);

  const municipalities = useMemo(() => values.province ? CUBA[values.province as keyof typeof CUBA] ?? [] : [], [values.province]);

  const stepTitle = useMemo(() => {
    if (step === 1) return '¿Qué quieres publicar?';
    if (step === 2) return 'Información de la mascota';
    if (step === 3) return 'Fecha y ubicación';
    if (step === 4) return 'Fotos';
    return 'Contacto y vista previa';
  }, [step]);

  const totalSteps = 5;

  const updateValue = <K extends keyof PublicationFormValues>(key: K, value: PublicationFormValues[K]) => {
    if (key === 'province') {
      setValues((current) => ({ ...current, [key]: value, municipality: '' }));
    } else {
      setValues((current) => ({ ...current, [key]: value }));
    }
  };

  const handleFiles = (event: ChangeEvent<HTMLInputElement>) => {
    const totalImages = existingImages.length + files.length;
    const remainingSlots = MAX_IMAGES - totalImages;
    if (remainingSlots <= 0) {
      setErrorMessage(`Límite de ${MAX_IMAGES} imágenes alcanzado. Elimina alguna para agregar más.`);
      return;
    }
    const newFiles = Array.from(event.target.files ?? []).slice(0, remainingSlots);
    const validFiles: File[] = [];
    const previews: string[] = [];

    for (const file of newFiles) {
      if (!ALLOWED_IMAGE_TYPES.includes(file.type as typeof ALLOWED_IMAGE_TYPES[number])) {
        setErrorMessage(`Formato no permitido: ${file.name}. Usa JPG, PNG o WebP.`);
        return;
      }
      if (file.size > MAX_IMAGE_BYTES) {
        setErrorMessage(`${file.name}: excede 8 MB.`);
        return;
      }
      validFiles.push(file);
      previews.push(URL.createObjectURL(file));
    }

    setFiles((prev) => [...prev, ...validFiles]);
    setFilePreviews((prev) => [...prev, ...previews]);
    setErrorMessage(null);
  };

  const removeFile = (index: number) => {
    // Determinar si es una imagen existente o nueva
    const existingCount = existingImages.length;
    if (index < existingCount) {
      // Es una imagen existente - marcar para eliminación (filtrar de existingImages)
      setExistingImages((prev) => prev.filter((_, i) => i !== index));
      setFilePreviews((prev) => prev.filter((_, i) => i !== index));
    } else {
      // Es una imagen nueva - revocar URL y filtrar de files
      const fileIndex = index - existingCount;
      URL.revokeObjectURL(filePreviews[index]);
      setFiles((prev) => prev.filter((_, i) => i !== fileIndex));
      setFilePreviews((prev) => prev.filter((_, i) => i !== index));
    }
  };

  const handleAIDataExtracted = (data: {
    species?: string;
    breed?: string;
    sex?: string;
    size?: string;
    ageApprox?: string;
    color?: string;
    characteristics?: string;
    collar?: boolean;
    plate?: boolean;
    province?: string;
    municipality?: string;
    zone?: string;
    reward?: string;
    eventDate?: string;
    eventTimeApprox?: string;
    contactMode?: 'INTERNAL' | 'PHONE' | 'WHATSAPP' | 'EMAIL';
    contactPhone?: string;
    contactWhatsapp?: string;
    contactEmail?: string;
  }) => {
    // Actualizar los valores del formulario con los datos extraídos
    setValues((current) => ({
      ...current,
      // Datos del animal
      ...(data.species && { species: data.species }),
      ...(data.breed && { breed: data.breed }),
      ...(data.sex && { sex: data.sex }),
      ...(data.size && { size: data.size }),
      ...(data.ageApprox && { ageApprox: data.ageApprox }),
      ...(data.color && { color: data.color }),
      ...(data.characteristics && { characteristics: data.characteristics }),
      ...(data.collar !== undefined && { collar: data.collar }),
      ...(data.plate !== undefined && { plate: data.plate }),
      // Datos contextuales (ubicación, contacto, etc.)
      ...(data.province && { province: data.province }),
      ...(data.municipality && { municipality: data.municipality }),
      ...(data.zone && { zone: data.zone }),
      ...(data.reward && { reward: data.reward }),
      ...(data.eventDate && { eventDate: data.eventDate }),
      ...(data.eventTimeApprox && { eventTimeApprox: data.eventTimeApprox }),
      ...(data.contactMode && { contactMode: data.contactMode }),
      ...(data.contactPhone && { contactPhone: data.contactPhone }),
      ...(data.contactWhatsapp && { contactWhatsapp: data.contactWhatsapp }),
      ...(data.contactEmail && { contactEmail: data.contactEmail }),
    }));
  };

  const handleFacebookImportComplete = (data: PublicationFormValues, sourceUrl: string) => {
    setValues(data);
    setFacebookSourceUrl(sourceUrl);
    setShowFacebookImport(false);
    // Saltar al paso 2 (datos de mascota) si está en paso 1
    if (step === 1) setStep(2);
  };

  const handleGeocode = async () => {
    if (!addressSearch.trim()) {
      setErrorMessage('Escribe una dirección para buscar');
      return;
    }

    setGeocoding(true);
    setErrorMessage(null);

    try {
      // Construir consulta con contexto de Cuba
      const searchParts = [addressSearch];
      if (values.municipality) searchParts.push(values.municipality);
      if (values.province) searchParts.push(values.province);
      searchParts.push('Cuba');
      
      const query = searchParts.join(', ');
      console.log('🔍 Geocodificando:', query);

      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=cu`,
        {
          headers: {
            'User-Agent': 'Patitas App'
          }
        }
      );
      
      if (!response.ok) {
        throw new Error('Error al buscar la dirección');
      }

      const data = await response.json();
      
      if (data.length === 0) {
        setErrorMessage('No se encontró la dirección. Intenta ser más específico o usa el mapa directamente.');
        return;
      }

      const location = data[0];
      const lat = parseFloat(location.lat);
      const lng = parseFloat(location.lon);

      // Aplicar difuminación de ±50m (±0.0005°)
      const fuzzLat = lat + (Math.random() - 0.5) * 0.001;
      const fuzzLng = lng + (Math.random() - 0.5) * 0.001;

      console.log('✅ Ubicación encontrada:', { 
        address: location.display_name,
        original: { lat, lng },
        difuminada: { fuzzLat, fuzzLng }
      });

      updateValue('approximateLat', fuzzLat.toFixed(6));
      updateValue('approximateLng', fuzzLng.toFixed(6));
      setAddressSearch('');
      
    } catch (error) {
      console.error('❌ Error en geocodificación:', error);
      setErrorMessage('No se pudo encontrar la dirección. Intenta con el mapa.');
    } finally {
      setGeocoding(false);
    }
  };

  const validateStep = (currentStep: number): string | null => {
    if (currentStep === 1) {
      if (!values.title || values.title.trim().length < 3) {
        return 'El título debe tener al menos 3 caracteres.';
      }
      if (!values.description || values.description.trim().length < 20) {
        return 'La descripción debe tener al menos 20 caracteres.';
      }
    }
    
    if (currentStep === 2) {
      if (!values.species || values.species.trim().length < 2) {
        return 'Debes seleccionar una especie.';
      }
      if (!values.color || values.color.trim().length < 2) {
        return 'Debes describir el color principal (mínimo 2 caracteres).';
      }
    }
    
    if (currentStep === 3) {
      if (!values.province || values.province.trim().length < 2) {
        return 'Debes seleccionar una provincia.';
      }
      if (!values.municipality || values.municipality.trim().length < 2) {
        return 'Debes seleccionar un municipio.';
      }
      // Las coordenadas ahora son opcionales - se pueden agregar por mapa o por dirección
      // if (!values.approximateLat || !values.approximateLng) {
      //   return 'Debes hacer clic en el mapa para marcar la ubicación aproximada.';
      // }
    }
    
    if (currentStep === 5) {
      if (values.contactMode === 'PHONE' && (!values.contactPhone || values.contactPhone.trim().length === 0)) {
        return 'Debes ingresar un número de teléfono.';
      }
      if (values.contactMode === 'WHATSAPP' && (!values.contactWhatsapp || values.contactWhatsapp.trim().length === 0)) {
        return 'Debes ingresar un número de WhatsApp.';
      }
      if (values.contactMode === 'EMAIL' && (!values.contactEmail || values.contactEmail.trim().length === 0)) {
        return 'Debes ingresar un correo electrónico.';
      }
    }
    
    return null;
  };

  const nextStep = () => {
    const error = validateStep(step);
    if (error) {
      setErrorMessage(error);
      return;
    }
    
    setErrorMessage(null);
    if (step < totalSteps) {
      setStep((current) => current + 1);
    }
  };

  const previousStep = () => {
    if (step > 1) {
      setStep((current) => current - 1);
    }
  };

  const handleSubmit = async () => {
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const parsed = publicationFormSchema.parse(values);

      if (isEditing && editingPublicationId) {
        // MODO EDICIÓN: Actualizar publicación existente
        console.log('📝 Actualizando publicación:', editingPublicationId);

        // Actualizar ubicación si cambió
        const _locationId = await createLocation({
          province: parsed.province,
          municipality: parsed.municipality,
          zone: parsed.zone,
          approximateLat: parsed.approximateLat,
          approximateLng: parsed.approximateLng,
        });

        // Actualizar mascota - crear nueva o usar existente
        const _petId = await createPet({
          ownerProfileId: user?.id ?? '',
          species: parsed.species,
          breed: parsed.breed,
          sex: parsed.sex,
          size: parsed.size,
          ageApprox: parsed.ageApprox,
          color: parsed.color,
          characteristics: parsed.characteristics,
          collar: parsed.collar,
          plate: parsed.plate,
          microchip: parsed.microchip,
        });
        // Actualizar publicación
        await updatePublication(editingPublicationId, {
          title: parsed.title,
          description: parsed.description,
          type: parsed.type,
          species: parsed.species,
          breed: parsed.breed,
          sex: parsed.sex,
          size: parsed.size,
          ageApprox: parsed.ageApprox,
          color: parsed.color,
          characteristics: parsed.characteristics,
          collar: parsed.collar,
          plate: parsed.plate,
          reward: parsed.reward,
          contactMode: parsed.contactMode,
          contactPhone: parsed.contactPhone,
          contactWhatsapp: parsed.contactWhatsapp,
          contactEmail: parsed.contactEmail,
          eventDate: parsed.eventDate,
          eventTimeApprox: parsed.eventTimeApprox,
          // Ubicación
          province: parsed.province,
          municipality: parsed.municipality,
          zone: parsed.zone,
          approximateLng: parsed.approximateLng,
        });

        // Eliminar imágenes que se quitaron
        const removedImages = originalExistingImages
          .filter((orig) => !existingImages.some((curr) => curr.storage_path === orig.storage_path))
          .map((img) => img.storage_path);
        if (removedImages.length > 0) {
          await deletePublicationImages(editingPublicationId, removedImages);
        }

        // Subir nuevas imágenes si hay
        if (files.length > 0) {
          await uploadPublicationImages(editingPublicationId, files, {
            onProgress: setUploadProgress,
            retries: 2,
          });
        }

        navigate(`/p/${originalSlug ?? ''}`); // El slug no cambia en edición
      } else {
        // MODO CREACIÓN: Crear nueva publicación
        const slug = buildPublicationSlug(parsed.title);

        console.log('📝 Datos del formulario parseados:', {
          province: parsed.province,
          municipality: parsed.municipality,
          zone: parsed.zone,
          approximateLat: parsed.approximateLat,
          approximateLng: parsed.approximateLng,
        });

        const locationId = await createLocation({
          province: parsed.province,
          municipality: parsed.municipality,
          zone: parsed.zone,
          approximateLat: parsed.approximateLat,
          approximateLng: parsed.approximateLng,
        });

        console.log('✅ Location creada con ID:', locationId);

        const petId = await createPet({
          ownerProfileId: user?.id ?? '',
          species: parsed.species,
          breed: parsed.breed,
          sex: parsed.sex,
          size: parsed.size,
          ageApprox: parsed.ageApprox,
          color: parsed.color,
          characteristics: parsed.characteristics,
          collar: parsed.collar,
          plate: parsed.plate,
          microchip: parsed.microchip,
        });

        const publication = await createPublication({
          ownerProfileId: user?.id ?? '',
          slug,
          locationId,
          petId,
          type: parsed.type,
          title: parsed.title,
          description: parsed.description,
          species: parsed.species,
          breed: parsed.breed,
          sex: parsed.sex,
          size: parsed.size,
          ageApprox: parsed.ageApprox,
          color: parsed.color,
          characteristics: parsed.characteristics,
          collar: parsed.collar,
          plate: parsed.plate,
          reward: parsed.reward,
          contactMode: parsed.contactMode,
          contactPhone: parsed.contactPhone,
          contactWhatsapp: parsed.contactWhatsapp,
          contactEmail: parsed.contactEmail,
          eventDate: parsed.eventDate,
          eventTimeApprox: parsed.eventTimeApprox,
          // Campos de importación (si viene de Facebook Import)
          isImported: facebookSourceUrl.length > 0,
          sourcePlatform: facebookSourceUrl.length > 0 ? 'FACEBOOK_PUBLIC' : undefined,
          sourceUrl: facebookSourceUrl || undefined,
          importReviewStatus: 'MANUAL_APPROVED',
        });

        if (files.length > 0) {
          await uploadPublicationImages(publication.id, files, {
            onProgress: setUploadProgress,
            retries: 2,
          });
        }

        setSuccessSlug(slug);
        // Limpiar URL de fuente después de crear
        setFacebookSourceUrl('');
        navigate(`/p/${slug}`);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'issues' in error) {
        const zodError = error as { issues: Array<{ path: string[]; message: string }> };
        const firstError = zodError.issues[0];
        const fieldName = firstError.path[0] || 'desconocido';
        setErrorMessage(`Error en el campo "${fieldName}": ${firstError.message}`);
      } else {
        setErrorMessage(error instanceof Error ? error.message : 'No pudimos procesar el caso.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-6 py-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-orange/10 via-cream to-turquoise/10 border-2 border-navy/10 p-8 shadow-md">
        <div className="blob-decoration absolute top-5 right-5 w-24 h-24 bg-purple/20" />
        
        <div className="relative space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-navy/60">
              {isEditing ? 'Editar caso' : 'Publicar caso'}
            </span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl font-extrabold text-navy">
            {isEditing ? `Editar: ${values.title || 'Cargando...'}` : stepTitle}
          </h1>
          <p className="text-lg text-navy/70 max-w-2xl">
            {isEditing
              ? 'Modifica los campos que necesites. Los cambios se guardarán al finalizar.'
              : 'El wizard guía la publicación en pasos cortos para que el caso quede estructurado y fácil de buscar.'}
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <PawLoader size="lg" />
          <p className="font-display text-lg font-semibold text-navy">Cargando sesión...</p>
        </div>
      ) : user ? (
        <div className="rounded-3xl border-2 border-navy/10 bg-white p-6 lg:p-8 space-y-6 shadow-md">
          <div className="flex items-center justify-between gap-4 text-sm font-semibold text-navy/70">
            <span>Paso {step} de {totalSteps}</span>
            <span className="text-turquoise">{user.email}</span>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 px-2 -mx-2" aria-label="Pasos del wizard">
            {[1, 2, 3, 4, 5].map((s) => (
              <div
                key={s}
                className={[
                  'shrink-0 size-10 rounded-full flex items-center justify-center text-sm font-bold transition-all',
                  s === step
                    ? 'bg-orange text-white shadow-paw scale-110'
                    : s < step
                    ? 'bg-turquoise text-white'
                    : 'bg-navy/10 text-navy/60',
                ].join(' ')}
              >
                {s}
              </div>
            ))}
          </div>

          {step === 1 && (
            <div className="space-y-4">
              <fieldset className="space-y-3">
                <legend className="text-sm font-semibold text-navy">Tipo de caso</legend>
                <div className="grid gap-3 sm:grid-cols-5">
                  {(Object.entries(TYPE_LABELS) as [string, string][]).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => updateValue('type', value as PublicationFormValues['type'])}
                      className={[
                        'rounded-2xl border-2 px-4 py-4 text-left transition-all hover:shadow-md hover:-translate-y-1',
                        values.type === value
                          ? 'border-orange bg-orange/10 shadow-paw'
                          : 'border-navy/10 bg-white',
                      ].join(' ')}
                    >
                      <span className="block text-xs font-bold uppercase tracking-[0.2em] text-navy/60">Tipo</span>
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-2xl">{TYPE_EMOJIS[value]}</span>
                        <span className="font-semibold text-navy">{label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </fieldset>

              <TextField
                label="Título *"
                placeholder="Toby perdido en Playa"
                value={values.title}
                onChange={(event) => updateValue('title', event.target.value)}
                required
              />
              <TextareaField
                label="Descripción breve *"
                placeholder="Cuéntanos lo ocurrido, señales y contexto (mínimo 20 caracteres)."
                value={values.description}
                onChange={(event) => updateValue('description', event.target.value)}
                required
              />
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              {/* Acciones de IA: Extracción de imagen + Importar Facebook */}
              <div className="space-y-3">
                {/* Autocompletado por IA: oculto si la IA está desactivada
                    (tarea 5.4). Con el proveedor mock los datos serían inventados. */}
                {isFeatureEnabled('ai') && (
                  <ImageDataExtractor
                    onDataExtracted={handleAIDataExtracted}
                    disabled={submitting}
                  />
                )}
                
                <div className="border-2 border-dashed border-purple/20 rounded-2xl p-4 bg-purple/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="size-10 rounded-xl bg-purple/10 flex items-center justify-center">
                        <Globe className="size-5 text-purple-600" />
                      </div>
                      <div>
                        <p className="font-semibold text-navy">Importar desde Facebook</p>
                        <p className="text-sm text-navy/60">Pega un enlace público o sube una captura → la IA pre-llena el formulario</p>
                      </div>
                    </div>
                    <Button 
                      variant="secondary" 
                      onClick={() => setShowFacebookImport(true)}
                      className="gap-2"
                    >
                      <Globe className="size-4" />
                      Importar
                    </Button>
                  </div>
                </div>
              </div>

              {/* Campos del formulario */}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-sm font-semibold text-navy">Especie *</span>
                  <select
                    className="w-full h-12 rounded-2xl border-2 border-navy/10 bg-white px-4 text-base text-navy shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
                    value={values.species}
                    onChange={(event) => updateValue('species', event.target.value)}
                    required
                  >
                    <option value="">Selecciona</option>
                    {(Object.entries(SPECIES_LABELS) as [string, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Raza"
                  placeholder="Husky siberiano"
                  value={values.breed ?? ''}
                  onChange={(event) => updateValue('breed', event.target.value)}
                />
                <label className="space-y-2">
                  <span className="block text-sm font-semibold text-navy">Sexo</span>
                  <select
                    className="w-full h-12 rounded-2xl border-2 border-navy/10 bg-white px-4 text-base text-navy shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
                    value={values.sex}
                    onChange={(event) => updateValue('sex', event.target.value)}
                  >
                    <option value="">Selecciona</option>
                    {(Object.entries(SEX_LABELS) as [string, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="block text-sm font-semibold text-navy">Tamaño</span>
                  <select
                    className="w-full h-12 rounded-2xl border-2 border-navy/10 bg-white px-4 text-base text-navy shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
                    value={values.size}
                    onChange={(event) => updateValue('size', event.target.value)}
                  >
                    <option value="">Selecciona</option>
                    {(Object.entries(SIZE_LABELS) as [string, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="block text-sm font-semibold text-navy">Edad aproximada</span>
                  <select
                    className="w-full h-12 rounded-2xl border-2 border-navy/10 bg-white px-4 text-base text-navy shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
                    value={values.ageApprox}
                    onChange={(event) => updateValue('ageApprox', event.target.value)}
                  >
                    <option value="">Selecciona</option>
                    {(Object.entries(AGE_LABELS) as [string, string][]).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Color *"
                  placeholder="Marrón y blanco"
                  value={values.color}
                  onChange={(event) => updateValue('color', event.target.value)}
                  required
                />
                <TextareaField
                  className="md:col-span-2"
                  label="Características"
                  placeholder="Marcas, cicatrices, comportamiento..."
                  value={values.characteristics ?? ''}
                  onChange={(event) => updateValue('characteristics', event.target.value)}
                />
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-3 rounded-2xl border-2 border-turquoise/20 bg-turquoise/5 px-4 py-3 text-sm font-semibold text-navy cursor-pointer transition hover:bg-turquoise/10">
                  <input type="checkbox" className="rounded border-turquoise text-turquoise focus:ring-turquoise" checked={values.collar} onChange={(event) => updateValue('collar', event.target.checked)} />
                  <Circle className="size-4 text-turquoise" aria-hidden="true" />
                  Tiene collar
                </label>
                <label className="flex items-center gap-3 rounded-2xl border-2 border-purple/20 bg-purple/5 px-4 py-3 text-sm font-semibold text-navy cursor-pointer transition hover:bg-purple/10">
                  <input type="checkbox" className="rounded border-purple text-purple focus:ring-purple" checked={values.plate} onChange={(event) => updateValue('plate', event.target.checked)} />
                  <Tag className="size-4 text-purple" aria-hidden="true" />
                  Tiene placa
                </label>
              </div>

              <TextField
                label="Microchip (privado)"
                placeholder="Número de microchip si tiene"
                value={values.microchip ?? ''}
                onChange={(event) => updateValue('microchip', event.target.value)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-sm font-semibold text-navy">Provincia *</span>
                  <select
                    className="w-full h-12 rounded-2xl border-2 border-navy/10 bg-white px-4 text-base text-navy shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
                    value={values.province}
                    onChange={(event) => updateValue('province', event.target.value)}
                    required
                  >
                    <option value="">Selecciona provincia</option>
                    {PROVINCES.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-2">
                  <span className="block text-sm font-semibold text-navy">Municipio *</span>
                  <select
                    className="w-full h-12 rounded-2xl border-2 border-navy/10 bg-white px-4 text-base text-navy shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20 disabled:opacity-50"
                    value={values.municipality}
                    onChange={(event) => updateValue('municipality', event.target.value)}
                    disabled={municipalities.length === 0}
                    required
                  >
                    <option value="">Selecciona municipio</option>
                    {municipalities.map((m) => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </label>
                <TextField
                  label="Zona / Referencia"
                  placeholder="Cerca del malecón"
                  value={values.zone ?? ''}
                  onChange={(event) => updateValue('zone', event.target.value)}
                />
                <TextField
                  label="Fecha del evento"
                  type="date"
                  value={values.eventDate ?? ''}
                  onChange={(event) => updateValue('eventDate', event.target.value)}
                />
                <TextField
                  label="Hora aproximada"
                  type="time"
                  value={values.eventTimeApprox ?? ''}
                  onChange={(event) => updateValue('eventTimeApprox', event.target.value)}
                />
                <TextField
                  label="Recompensa (opcional)"
                  placeholder="Ej. 500 CUP"
                  value={values.reward ?? ''}
                  onChange={(event) => updateValue('reward', event.target.value)}
                />
              </div>

              <fieldset className="space-y-4">
                <div className="bg-turquoise/10 border-2 border-turquoise/30 rounded-2xl p-4">
                  <legend className="text-base font-bold text-navy mb-2">📍 Ubicación aproximada</legend>
                  <p className="text-sm text-navy/70 mb-4">
                    Puedes marcar la ubicación de dos formas: escribiendo la dirección o haciendo clic en el mapa.
                  </p>

                  {/* Campo de búsqueda de dirección */}
                  <div className="mb-4 p-4 bg-white rounded-xl border-2 border-navy/10">
                    <label className="block text-sm font-semibold text-navy mb-2">
                      🔍 Buscar por dirección
                    </label>
                    <p className="text-xs text-navy/60 mb-3">
                      Escribe la calle, avenida o lugar específico. Ejemplo: "Calle 23 y 12, Vedado"
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={addressSearch}
                        onChange={(e) => setAddressSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            handleGeocode();
                          }
                        }}
                        placeholder="Ej: Malecón, esquina Prado"
                        className="flex-1 h-11 rounded-xl border-2 border-navy/10 bg-white px-4 text-sm font-medium text-navy shadow-sm outline-none transition hover:border-navy/20 focus:border-orange focus:ring-4 focus:ring-orange/20"
                        disabled={geocoding}
                      />
                      <Button
                        type="button"
                        onClick={handleGeocode}
                        disabled={geocoding || !addressSearch.trim()}
                        variant="secondary"
                        className="shrink-0"
                      >
                        {geocoding ? 'Buscando...' : 'Buscar'}
                      </Button>
                    </div>
                  </div>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-navy/20"></div>
                    </div>
                    <div className="relative flex justify-center text-xs">
                      <span className="bg-turquoise/10 px-2 text-navy/60">O usa el mapa</span>
                    </div>
                  </div>

                  {!values.approximateLat && !values.approximateLng && (
                    <div className="mt-4 bg-orange/10 border-2 border-orange/30 rounded-xl px-4 py-3 flex items-start gap-3">
                      <span className="text-2xl shrink-0">👆</span>
                      <div>
                        <p className="text-sm font-semibold text-orange">Busca la dirección o haz clic en el mapa</p>
                        <p className="text-xs text-orange/80">La ubicación ayuda a otros a encontrar el caso</p>
                      </div>
                    </div>
                  )}
                  {values.approximateLat && values.approximateLng && (
                    <div className="mt-4 bg-turquoise/10 border-2 border-turquoise/30 rounded-xl px-4 py-3 flex items-start gap-3">
                      <span className="text-2xl shrink-0">✅</span>
                      <div>
                        <p className="text-sm font-semibold text-turquoise">Ubicación marcada</p>
                        <p className="text-xs text-turquoise/80">Puedes buscar de nuevo o hacer clic en el mapa para ajustar</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="h-80 rounded-2xl border-4 border-turquoise/30 overflow-hidden shadow-lg ring-4 ring-turquoise/10">
                  <MapContainer center={[23.1136, -82.3666]} zoom={8} className="h-full w-full cursor-crosshair">
                    <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    {values.approximateLat && values.approximateLng && (
                      <Marker position={[parseFloat(values.approximateLat), parseFloat(values.approximateLng)]} />
                    )}
                    <LocationPicker
                      onChange={(lat, lng) => {
                        updateValue('approximateLat', lat);
                        updateValue('approximateLng', lng);
                        setErrorMessage(null);
                      }}
                    />
                  </MapContainer>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <TextField
                    label="Latitud aprox."
                    placeholder="Usa el buscador o el mapa"
                    value={values.approximateLat ?? ''}
                    onChange={(event) => updateValue('approximateLat', event.target.value)}
                    readOnly
                  />
                  <TextField
                    label="Longitud aprox."
                    placeholder="Usa el buscador o el mapa"
                    value={values.approximateLng ?? ''}
                    onChange={(event) => updateValue('approximateLng', event.target.value)}
                    readOnly
                  />
                </div>

                <div className="bg-purple/5 border border-purple/20 rounded-2xl px-4 py-3">
                  <p className="text-xs text-navy/70 flex items-start gap-2">
                    <span className="text-base">🔒</span>
                    <span>
                      <strong>Privacidad:</strong> Las coordenadas se difuminan automáticamente ±50 metros 
                      para proteger tu ubicación exacta. Solo se muestra una zona aproximada.
                    </span>
                  </p>
                </div>
              </fieldset>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <label className="block space-y-3">
                <span className="text-sm font-semibold text-navy">
                  📸 Imágenes (máx. {MAX_IMAGES}, JPG/PNG/WebP, 8 MB c/u)
                  {existingImages.length > 0 && (
                    <span className="ml-2 text-xs font-normal text-found bg-found/10 border border-found/20 rounded-full px-2 py-0.5">
                      {existingImages.length} guardada{existingImages.length > 1 ? 's' : ''}
                    </span>
                  )}
                </span>
                <input 
                  type="file" 
                  accept="image/jpeg,image/png,image/webp" 
                  multiple 
                  onChange={handleFiles} 
                  className="w-full rounded-2xl border-2 border-navy/10 bg-white px-4 py-3 text-sm transition hover:border-orange/50 file:mr-4 file:rounded-pill file:border-0 file:bg-orange/10 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-orange hover:file:bg-orange/20" 
                  disabled={(existingImages.length + files.length) >= MAX_IMAGES} 
                />
                {(existingImages.length + files.length) >= MAX_IMAGES && (
                  <span className="text-xs font-medium text-lost bg-lost/10 border border-lost/20 rounded-full px-3 py-1 inline-block">
                    Límite de {MAX_IMAGES} imágenes alcanzado
                  </span>
                )}

                {/* Progreso de subida: las fotos se comprimen en el navegador
                    (máx. 1600 px y ~1 MB) y se envían a /api/uploads, que quita
                    el EXIF y rechaza las que traen GPS. */}
                {uploadProgress && (
                  <div className="w-full" aria-live="polite">
                    <div className="mb-1 flex items-center justify-between text-xs font-semibold text-navy/70">
                      <span>
                        {uploadProgress.stage === 'done'
                          ? `Imagen ${uploadProgress.uploadingIndex} de ${uploadProgress.totalFiles} lista`
                          : `Preparando imagen ${uploadProgress.fileIndex} de ${uploadProgress.totalFiles}`}
                      </span>
                      <span>{uploadProgress.percent}%</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-navy/10">
                      <div
                        className="h-full rounded-full bg-turquoise transition-all duration-300"
                        style={{ width: `${uploadProgress.percent}%` }}
                      />
                    </div>
                    <p className="mt-1 text-xs text-navy/50">
                      Se quitan los metadatos de la foto (incluida la ubicación GPS).
                    </p>
                  </div>
                )}
              </label>

              {filePreviews.length > 0 && (
                <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                  {filePreviews.map((preview, index) => {
                    const isExisting = index < existingImages.length;
                    return (
                      <div key={index} className="group relative aspect-square rounded-2xl overflow-hidden border-2 shadow-md transition-all hover:shadow-lg hover:-translate-y-1"
                        style={{ borderColor: isExisting ? 'rgb(34, 197, 94)' : 'rgb(229, 231, 235)' }}>
                        <img src={preview} alt={`Preview ${index + 1}`} className="w-full h-full object-cover transition-transform group-hover:scale-110" />
                        {index === 0 && (
                          <span className="absolute top-2 left-2 rounded-full bg-orange text-white px-3 py-1 text-xs font-bold shadow-paw">
                            Portada
                          </span>
                        )}
                        {isExisting && (
                          <span className="absolute top-2 right-2 rounded-full bg-found text-white px-2 py-0.5 text-xs font-bold flex items-center gap-1">
                            <span className="size-1.5 rounded-full bg-white animate-pulse" />
                            Guardada
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="absolute bottom-2 right-2 rounded-full bg-navy/80 text-white p-2 hover:bg-navy transition backdrop-blur-sm"
                          aria-label={isExisting ? 'Quitar imagen guardada' : 'Eliminar imagen nueva'}
                        >
                          ×
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
              
              {filePreviews.length === 0 && (
                <div className="rounded-2xl border-2 border-dashed border-navy/20 bg-navy/5 p-12 text-center">
                  <p className="text-sm text-navy/60">Aún no has agregado ninguna imagen</p>
                  <p className="text-xs text-navy/40 mt-2">La primera imagen será la portada</p>
                </div>
              )}
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-2">
                  <span className="block text-sm font-semibold text-navy">Modo de contacto</span>
                  <select
                    className="w-full h-12 rounded-2xl border-2 border-navy/10 bg-white px-4 text-base text-navy shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20"
                    value={values.contactMode}
                    onChange={(event) => updateValue('contactMode', event.target.value as PublicationFormValues['contactMode'])}
                  >
                    <option value="INTERNAL">Contacto interno (chat Patitas)</option>
                    <option value="PHONE">Mostrar teléfono</option>
                    <option value="WHATSAPP">Mostrar WhatsApp</option>
                    <option value="EMAIL">Mostrar email</option>
                  </select>
                </label>
                {values.contactMode === 'PHONE' && (
                  <TextField
                    label="Teléfono"
                    placeholder="+53..."
                    value={values.contactPhone ?? ''}
                    onChange={(event) => updateValue('contactPhone', event.target.value)}
                  />
                )}
                {values.contactMode === 'WHATSAPP' && (
                  <TextField
                    label="WhatsApp"
                    placeholder="+53..."
                    value={values.contactWhatsapp ?? ''}
                    onChange={(event) => updateValue('contactWhatsapp', event.target.value)}
                  />
                )}
                {values.contactMode === 'EMAIL' && (
                  <TextField
                    label="Email"
                    type="email"
                    placeholder="tu@correo.com"
                    value={values.contactEmail ?? ''}
                    onChange={(event) => updateValue('contactEmail', event.target.value)}
                  />
                )}
              </div>

              <div className="rounded-2xl border-2 border-turquoise/20 bg-turquoise/5 p-6 space-y-3 shadow-sm">
                <h3 className="font-display text-xl font-extrabold text-navy flex items-center gap-2">
                  👀 Vista previa
                </h3>
                <dl className="grid gap-3 sm:grid-cols-2 text-sm">
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Tipo</dt>
                    <dd className="font-semibold text-navy">{TYPE_LABELS[values.type] ?? values.type}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Título</dt>
                    <dd className="font-semibold text-navy">{values.title || '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Especie</dt>
                    <dd>{(SPECIES_LABELS[values.species] ?? values.species) || '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Raza</dt>
                    <dd>{values.breed || '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Sexo</dt>
                    <dd>{values.sex ? (SEX_LABELS[values.sex] ?? values.sex) : '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Tamaño</dt>
                    <dd>{values.size ? (SIZE_LABELS[values.size] ?? values.size) : '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Edad</dt>
                    <dd>{values.ageApprox || '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Color</dt>
                    <dd>{values.color || '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Provincia / Municipio</dt>
                    <dd>{values.province} / {values.municipality || '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Zona</dt>
                    <dd>{values.zone || '—'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Contacto</dt>
                    <dd>
                      {values.contactMode === 'INTERNAL' && 'Chat interno'}
                      {values.contactMode === 'PHONE' && values.contactPhone}
                      {values.contactMode === 'WHATSAPP' && values.contactWhatsapp}
                      {values.contactMode === 'EMAIL' && values.contactEmail}
                    </dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Recompensa</dt>
                    <dd>{values.reward || 'Sin especificar'}</dd>
                  </div>
                  <div className="space-y-1">
                    <dt className="text-xs font-semibold uppercase tracking-wider text-navy/60">Imágenes</dt>
                    <dd className="font-semibold text-turquoise">{files.length} de {MAX_IMAGES}</dd>
                  </div>
                </dl>
              </div>
            </div>
          )}

          {errorMessage ? (
            <div className="rounded-2xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm font-medium text-lost-dark flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <p>{errorMessage}</p>
            </div>
          ) : null}
          {successSlug ? (
            <div className="rounded-2xl bg-found/10 border-2 border-found/20 px-4 py-3 text-sm font-medium text-found-dark flex items-start gap-3">
              <span className="text-lg">✅</span>
              <p>Publicación creada: {successSlug}</p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t-2 border-navy/10 pt-6 sm:flex-row sm:justify-between">
            <div className="flex gap-3">
              <Button type="button" variant="ghost" onClick={previousStep} disabled={step === 1}>← Atrás</Button>
              {step < totalSteps ? <Button type="button" onClick={nextStep}>Continuar →</Button> : null}
            </div>
            {step === totalSteps ? (
              <Button type="button" onClick={handleSubmit} disabled={submitting} className="gap-2">
                {submitting
                  ? '⏳ Guardando...'
                  : isEditing
                  ? '💾 Guardar cambios'
                  : '🐾 Publicar caso'}
              </Button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="rounded-3xl border-2 border-orange/20 bg-white p-8 shadow-md">
          <div className="max-w-md mx-auto text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-orange/10 flex items-center justify-center mx-auto">
              <span className="text-3xl">🔒</span>
            </div>
            <h2 className="font-display text-2xl font-extrabold text-navy">Necesitas iniciar sesión</h2>
            <p className="text-sm text-navy/70">La publicación requiere una sesión autenticada para guardar tu autoría y aplicar RLS.</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <LinkButton href="/auth/login">Iniciar sesión</LinkButton>
              <LinkButton href="/auth/register" variant="secondary">Crear cuenta</LinkButton>
            </div>
          </div>
        </div>
      )}
      
      {/* Facebook Import Modal */}
      {showFacebookImport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-3xl border-2 border-navy/10 shadow-2xl p-6 lg:p-8">
            <FacebookImportWizard onImportComplete={handleFacebookImportComplete} />
          </div>
        </div>
      )}
    </section>
  );
}

export default PublishPage;