import { safeLinkUrl } from '../../lib/utils/safe-url';
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Image, Loader2, AlertCircle, CheckCircle, X, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { supabase } from '../../lib/supabase/client';
import { facebookLinkImportSchema } from '../../lib/validations/facebook-import';
import type { PublicationFormValues } from '../../lib/validations/publication';
import { PROVINCES } from '../../lib/constants/cuba';
import { SPECIES_LABELS, SEX_LABELS, SIZE_LABELS, AGE_LABELS } from '../../lib/constants/labels';

type ImportTab = 'link' | 'screenshot';

type ExtractedData = {
  type?: 'LOST' | 'FOUND' | 'ADOPTION' | 'ABANDONED' | 'SIGHTING';
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
  province?: string;
  municipality?: string;
  zone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationPrecision?: 'municipality' | 'province' | 'none';
  eventDate?: string;
  eventTimeApprox?: string;
  confidence: Record<string, number>;
  sourceUrl?: string;
};

type ExtractedApiData = {
  type?: string;
  title?: string;
  description?: string;
  species?: string;
  breed?: string;
  color?: string;
  size?: string;
  sex?: string;
  age?: string;
  ageApprox?: string;
  characteristics?: string;
  collar?: boolean;
  plate?: boolean;
  province?: string;
  municipality?: string;
  zone?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  locationPrecision?: 'municipality' | 'province' | 'none';
  event_date?: string;
  eventDate?: string;
  event_time?: string;
  eventTimeApprox?: string;
  contact_phone?: string;
  contactPhone?: string;
  contact_whatsapp?: string;
  contactWhatsapp?: string;
  contact_email?: string;
  contactEmail?: string;
  reward?: string;
  confidence?: Record<string, number> | number;
};

/** Respuesta de los endpoints de importación. */
type ImportResponse = {
  success?: boolean;
  error?: string;
  data?: {
    title?: string;
    description?: string;
    image_url?: string;
    extracted?: ExtractedApiData;
    confidence?: number;
  };
};

const SPECIES_FROM_API: Record<string, string> = {
  perro: 'dog',
  perra: 'dog',
  dog: 'dog',
  canino: 'dog',
  gato: 'cat',
  gata: 'cat',
  cat: 'cat',
  felino: 'cat',
  ave: 'bird',
  pajaro: 'bird',
  bird: 'bird',
  conejo: 'rabbit',
  rabbit: 'rabbit',
  roedor: 'rodent',
  rodent: 'rodent',
  reptil: 'reptile',
  reptile: 'reptile',
  otro: 'other',
  other: 'other',
};

const SIZE_FROM_API: Record<string, string> = {
  pequeno: 'small',
  small: 'small',
  mini: 'small',
  mediano: 'medium',
  medium: 'medium',
  grande: 'large',
  large: 'large',
};

const SEX_FROM_API: Record<string, string> = {
  macho: 'male',
  male: 'male',
  hembra: 'female',
  female: 'female',
};

const AGE_FROM_API: Record<string, string> = {
  cachorro: 'puppy',
  puppy: 'puppy',
  joven: 'young',
  young: 'young',
  adulto: 'adult',
  adult: 'adult',
  anciano: 'senior',
  senior: 'senior',
  viejo: 'senior',
};

const TYPE_FROM_API: Record<string, ExtractedData['type']> = {
  lost: 'LOST',
  perdido: 'LOST',
  found: 'FOUND',
  encontrado: 'FOUND',
  adoption: 'ADOPTION',
  adopcion: 'ADOPTION',
  abandoned: 'ABANDONED',
  abandonado: 'ABANDONED',
  sighting: 'SIGHTING',
  avistamiento: 'SIGHTING',
};

function normalizeKey(value?: string): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function mapValue<T>(map: Record<string, T>, value?: string): T | undefined {
  return map[normalizeKey(value)];
}

/** Convierte `dd/mm/aaaa` o ISO a `YYYY-MM-DD` para el `<input type="date">`. */
function normalizeDateInput(value?: string): string | undefined {
  if (!value) return undefined;

  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);

  const match = value.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/);
  if (!match) return undefined;

  let year = Number(match[3]);
  if (year < 100) year += 2000;

  const month = Number(match[2]);
  const day = Number(match[1]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return undefined;

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Convierte `3:30 pm` o `15:30` a `HH:MM` para el `<input type="time">`. */
function normalizeTimeInput(value?: string): string | undefined {
  if (!value) return undefined;

  const match = value.match(/(\d{1,2}):(\d{2})\s*(am|pm|a\.?\s?m\.?|p\.?\s?m\.?)?/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = normalizeKey(match[3]);

  if (meridiem === 'pm' && hour < 12) hour += 12;
  if (meridiem === 'am' && hour === 12) hour = 0;
  if (hour > 23 || minute > 59) return undefined;

  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Normaliza la respuesta de la API a los enums del formulario.
 *
 * `facebook-screenshot` devuelve `PEQUENO`/`MACHO` y `Perro`/`Gato`; el
 * formulario usa `small`/`male` y `dog`/`cat`. Sin esta conversión los selects
 * se quedaban vacíos aunque la IA hubiera detectado el dato.
 */
function mapApiExtracted(api: ExtractedApiData | undefined): ExtractedData {
  if (!api) return { confidence: {} };

  return {
    type: mapValue(TYPE_FROM_API, api.type),
    title: api.title,
    description: api.description,
    species: mapValue(SPECIES_FROM_API, api.species),
    breed: api.breed,
    color: api.color,
    size: mapValue(SIZE_FROM_API, api.size),
    sex: mapValue(SEX_FROM_API, api.sex),
    ageApprox: mapValue(AGE_FROM_API, api.ageApprox ?? api.age),
    characteristics: api.characteristics,
    collar: api.collar ?? false,
    plate: api.plate ?? false,
    reward: api.reward,
    contactPhone: api.contact_phone ?? api.contactPhone,
    contactWhatsapp: api.contact_whatsapp ?? api.contactWhatsapp,
    contactEmail: api.contact_email ?? api.contactEmail,
    province: api.province,
    municipality: api.municipality,
    zone: api.zone,
    address: api.address,
    latitude: api.latitude,
    longitude: api.longitude,
    locationPrecision: api.locationPrecision,
    eventDate: normalizeDateInput(api.event_date ?? api.eventDate),
    eventTimeApprox: normalizeTimeInput(api.event_time ?? api.eventTimeApprox),
    // `buildFormExtraction` devuelve una confianza global (número); el panel de
    // revisión espera confianza por campo. Sin desglose no se muestra insignia.
    confidence: typeof api.confidence === 'number' ? {} : api.confidence ?? {},
  };
}

/** Devuelve el JWT de Supabase o lanza un error claro. */
async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error('Inicia sesión para importar desde Facebook.');
  }

  return token;
}


function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-found';
  if (confidence >= 0.4) return 'text-orange';
  return 'text-lost';
}

function getConfidenceLabel(confidence: number): string {
  if (confidence >= 0.7) return 'Alta';
  if (confidence >= 0.4) return 'Media';
  return 'Baja';
}

export function FacebookImportWizard({ onImportComplete }: { onImportComplete: (data: PublicationFormValues, sourceUrl: string) => void }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ImportTab>('link');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [showReview, setShowReview] = useState(false);
  const handleLinkSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const url = formData.get('url') as string;
    
    const validation = facebookLinkImportSchema.safeParse({ url });
    if (!validation.success) {
      setError('URL de Facebook inválida. Usa facebook.com, fb.com o fb.watch');
      setLoading(false);
      return;
    }
    
    try {
      const token = await getAccessToken();
      const response = await fetch('/api/import/facebook-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });

      const result = (await response.json().catch(() => null)) as ImportResponse | null;

      if (!response.ok) {
        throw new Error(result?.error || `Error ${response.status} al importar el enlace`);
      }

      if (!result || result.success === false) {
        throw new Error(result?.error || 'No se pudieron extraer datos del enlace');
      }

      const data = result.data;
      if (!data) {
        throw new Error('El servidor no devolvió datos del enlace');
      }

      const extracted: ExtractedData = {
        ...mapApiExtracted(data.extracted),
        // Los metadatos Open Graph son más fiables que el texto de la visión.
        title: data.title ?? undefined,
        description: data.description ?? undefined,
        sourceUrl: url,
      };

      if (data.image_url) {
        setImagePreview(data.image_url);
      }

      setExtractedData(extracted);
      setShowReview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScreenshotSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    
    const formData = new FormData(e.currentTarget);
    const file = formData.get('image') as File;
    
    if (!file) {
      setError('Selecciona una imagen');
      setLoading(false);
      return;
    }
    
    // Preview local
    const previewUrl = URL.createObjectURL(file);
    setImagePreview(previewUrl);
    
    try {
      const token = await getAccessToken();
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);

      const response = await fetch('/api/import/facebook-screenshot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadFormData,
      });

      const result = (await response.json().catch(() => null)) as ImportResponse | null;

      if (!response.ok) {
        throw new Error(result?.error || `Error ${response.status} al procesar la imagen`);
      }

      if (!result || result.success === false) {
        throw new Error(result?.error || 'No se pudieron extraer datos de la captura');
      }

      const extracted = mapApiExtracted(result.data?.extracted);

      setExtractedData(extracted);
      setShowReview(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleConfirmImport = useCallback(() => {
    if (!extractedData) return;
    
    // Convertir a PublicationFormValues
    const formData: PublicationFormValues = {
      type: extractedData.type ?? 'LOST',
      title: extractedData.title ?? `Reporte importado de Facebook`,
      description: extractedData.description ?? 'Importado desde Facebook',
      species: extractedData.species ?? '',
      breed: extractedData.breed ?? '',
      sex: (extractedData.sex as PublicationFormValues['sex']) ?? '',
      size: (extractedData.size as PublicationFormValues['size']) ?? '',
      ageApprox: (extractedData.ageApprox as PublicationFormValues['ageApprox']) ?? '',
      color: extractedData.color ?? '',
      characteristics: extractedData.characteristics ?? '',
      collar: extractedData.collar ?? false,
      plate: extractedData.plate ?? false,
      reward: extractedData.reward ?? '',
      contactMode: extractedData.contactPhone ? 'PHONE' : 
                   extractedData.contactWhatsapp ? 'WHATSAPP' : 
                   extractedData.contactEmail ? 'EMAIL' : 'INTERNAL',
      contactPhone: extractedData.contactPhone ?? '',
      contactWhatsapp: extractedData.contactWhatsapp ?? '',
      contactEmail: extractedData.contactEmail ?? '',
      microchip: '',
      province: extractedData.province ?? '',
      municipality: extractedData.municipality ?? '',
      zone: extractedData.zone ?? extractedData.address ?? '',
      approximateLat:
        extractedData.latitude !== undefined ? String(extractedData.latitude) : '',
      approximateLng:
        extractedData.longitude !== undefined ? String(extractedData.longitude) : '',
      eventDate: extractedData.eventDate ?? '',
      eventTimeApprox: extractedData.eventTimeApprox ?? '',
    };
    
    onImportComplete(formData, extractedData.sourceUrl ?? '');
    navigate('/publicar', { state: { importedData: formData, sourceUrl: extractedData.sourceUrl } });
  }, [extractedData, navigate, onImportComplete]);

  const handleCancel = useCallback(() => {
    setExtractedData(null);
    setImagePreview(null);
    setShowReview(false);
    setError(null);
  }, []);

  // Tabs
  const tabs: { id: ImportTab; label: string; icon: React.ReactNode }[] = [
    { id: 'link', label: 'Enlace', icon: <ExternalLink className="size-4" /> },
    { id: 'screenshot', label: 'Captura', icon: <Image className="size-4" /> },
  ];

  if (!showReview) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Globe className="size-8 text-orange" />
            <h2 className="font-display text-2xl font-bold text-foreground">Importar desde Facebook</h2>
          </div>
          <p className="text-foreground/60">
            Pega un enlace público de Facebook o sube una captura de pantalla.
            La IA extraerá la información para pre-llenar el formulario.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-foreground/5 rounded-xl p-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-surface text-foreground shadow-md'
                  : 'text-foreground/60 hover:text-foreground'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-4" role="tabpanel">
          {activeTab === 'link' && (
            <form onSubmit={handleLinkSubmit} className="space-y-4">
              <TextField
                label="Enlace de Facebook"
                placeholder="https://facebook.com/... o https://fb.watch/..."
                name="url"
                type="url"
                required
                error={error ?? undefined}
                hint="Solo enlaces públicos de facebook.com, fb.com, fb.watch. No se accede a contenido privado."
              />
              <Button type="submit" className="w-full" loading={loading}>
                <Loader2 className="size-4" />
                Importar desde enlace
              </Button>
              {error && (
                <div className="flex items-center gap-2 text-lost text-sm bg-lost/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="size-4" />
                  <span>{error}</span>
                  {error.includes('login') && <span className="text-foreground/50">→ Prueba subiendo una captura</span>}
                </div>
              )}
            </form>
          )}

          {activeTab === 'screenshot' && (
            <form onSubmit={handleScreenshotSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-foreground/20 rounded-2xl p-6 text-center hover:border-primary/50 transition-colors">
                <input
                  type="file"
                  name="image"
                  accept="image/jpeg,image/png,image/webp"
                  required
                  className="hidden"
                  id="screenshot-upload"
                  onChange={(e) => e.currentTarget.files?.[0] && setImagePreview(URL.createObjectURL(e.currentTarget.files[0]))}
                />
                <label htmlFor="screenshot-upload" className="cursor-pointer flex flex-col items-center gap-3">
                  <Image className="size-12 text-foreground/30" />
                  <span className="font-medium text-foreground">Sube una captura de pantalla</span>
                  <span className="text-sm text-foreground/50">JPG, PNG, WebP · Máx 8MB</span>
                </label>
              </div>
              {imagePreview && (
                <div className="relative rounded-xl overflow-hidden border-2 border-foreground/10">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); URL.revokeObjectURL(imagePreview); }}
                    className="absolute top-2 right-2 bg-lost/100 text-white rounded-full p-1 hover:bg-lost-dark"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              )}
              <Button type="submit" className="w-full" loading={loading} disabled={!imagePreview}>
                <Loader2 className="size-4" />
                Analizar captura con IA
              </Button>
              {error && (
                <div className="flex items-center gap-2 text-lost text-sm bg-lost/10 px-3 py-2 rounded-lg">
                  <AlertCircle className="size-4" />
                  <span>{error}</span>
                </div>
              )}
            </form>
          )}

          {/* Info box */}
          <div className="bg-secondary/40 border border-border rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="size-8 rounded-lg bg-secondary flex items-center justify-center">
                <Globe className="size-4 text-orange" />
              </span>
              <div className="text-sm text-foreground/70 space-y-1">
                <p className="font-medium">¿Qué hace esta función?</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>Lee metadatos públicos (Open Graph) de enlaces de Facebook</li>
                  <li>Con capturas: usa OCR + visión para extraer texto e info visual</li>
                  <li>Pre-llena el formulario de publicación para que revises y publiques</li>
                  <li>Nunca accede a contenido privado ni salta muros de login</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Vista de revisión de datos extraídos
  if (!extractedData) return null;

  const fields: { key: keyof ExtractedData; label: string; type?: 'text' | 'select' | 'boolean'; options?: string[] }[] = [
    { key: 'type', label: 'Tipo', type: 'select', options: ['LOST', 'FOUND', 'ADOPTION', 'ABANDONED'] },
    { key: 'title', label: 'Título' },
    { key: 'description', label: 'Descripción' },
    { key: 'species', label: 'Especie', type: 'select', options: Object.keys(SPECIES_LABELS) },
    { key: 'breed', label: 'Raza' },
    { key: 'color', label: 'Color' },
    { key: 'size', label: 'Tamaño', type: 'select', options: Object.keys(SIZE_LABELS) },
    { key: 'sex', label: 'Sexo', type: 'select', options: Object.keys(SEX_LABELS) },
    { key: 'ageApprox', label: 'Edad aprox.', type: 'select', options: Object.keys(AGE_LABELS) },
    { key: 'collar', label: 'Collar', type: 'boolean' },
    { key: 'plate', label: 'Placa', type: 'boolean' },
    { key: 'reward', label: 'Recompensa' },
    { key: 'contactPhone', label: 'Teléfono' },
    { key: 'contactWhatsapp', label: 'WhatsApp' },
    { key: 'contactEmail', label: 'Email' },
    { key: 'province', label: 'Provincia', type: 'select', options: PROVINCES },
    { key: 'municipality', label: 'Municipio' },
    { key: 'zone', label: 'Zona/Barrio' },
    { key: 'eventDate', label: 'Fecha del evento' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CheckCircle className="size-8 text-found" />
          <div>
            <h2 className="font-display text-xl font-bold text-foreground">Datos extraídos</h2>
            <p className="text-sm text-foreground/60">Revisa y corrige antes de continuar al formulario</p>
          </div>
        </div>
        <Button variant="ghost" onClick={handleCancel}>
          <X className="size-4" />
          Cancelar
        </Button>
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="relative rounded-xl overflow-hidden border-2 border-foreground/10 max-w-md mx-auto">
          <img src={imagePreview} alt="Imagen importada" className="w-full h-48 object-cover" />
        </div>
      )}

      {/* Fields grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fields.map((field) => {
          const value = extractedData[field.key] as string | boolean | undefined;
          const confidence = extractedData.confidence[field.key] ?? 0;
          const hasValue = value !== undefined && value !== '' && value !== false;
          
          if (!hasValue && confidence === 0) return null;
          
          return (
            <div key={field.key} className="bg-surface/50 rounded-xl p-4 border border-foreground/10">
              <label className="block text-xs font-semibold text-foreground/60 mb-1 flex items-center gap-1">
                {field.label}
                {confidence > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${getConfidenceColor(confidence)}`}
                    title={`Confidence: ${Math.round(confidence * 100)}% (${getConfidenceLabel(confidence)})`}
                  >
                    {Math.round(confidence * 100)}%
                  </span>
                )}
              </label>
              <div className="font-medium text-foreground min-h-[1.5rem]">
                {field.type === 'boolean' ? (
                  value ? (
                    <span className="inline-flex items-center gap-1 text-found">
                      <CheckCircle className="size-3.5" /> Sí
                    </span>
                  ) : (
                    <span className="text-foreground/40">No detectado</span>
                  )
                ) : (
                  value ?? <span className="text-foreground/30 italic">No detectado</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Source URL */}
      {extractedData.sourceUrl && (
        <div className="bg-secondary/40 border border-border rounded-xl p-4">
          <p className="text-sm font-medium text-foreground mb-1">Fuente original</p>
          <a href={safeLinkUrl(extractedData.sourceUrl) ?? undefined} target="_blank" rel="noopener noreferrer nofollow ugc" className="flex items-center gap-2 text-orange hover:underline text-sm">
            <ExternalLink className="size-3.5" />
            Ver post en Facebook
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-foreground/10">
        <Button variant="secondary" onClick={handleCancel} className="flex-1">
          Editar manualmente
        </Button>
        <Button onClick={handleConfirmImport} className="flex-1">
          Continuar al formulario
        </Button>
      </div>
    </div>
  );
}

export default FacebookImportWizard;