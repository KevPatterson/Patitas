import { useCallback, useState, type ChangeEvent, type DragEvent, type FormEvent } from 'react';
import {
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ExternalLink,
  Image as ImageIcon,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { TextareaField } from '../ui/textarea-field';
import { CatLoader } from '../ui/cat-loader';
import { supabase } from '../../lib/supabase/client';
import { safeLinkUrl } from '../../lib/utils/safe-url';
import { fileToDataUrl } from '../../lib/utils/image-compression';
import {
  facebookLinkImportSchema,
  isFacebookBoilerplate,
} from '../../lib/validations/facebook-import';
import type { ImportedData } from '../../lib/import/merge-imported-data';
import {
  AGE_LABELS,
  ALLOWED_IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  SEX_LABELS,
  SIZE_LABELS,
  SPECIES_LABELS,
  TYPE_LABELS,
} from '../../lib/constants/labels';
import { PROVINCES, CUBA } from '../../lib/constants/cuba';

/** Respuesta cruda de los endpoints (mezcla claves camelCase y snake_case). */
type RawExtracted = {
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
  confidence?: number | Record<string, number>;
  ocrText?: string;
};

type ImageResponse = {
  ok?: boolean;
  extracted?: RawExtracted;
  provider_is_real?: boolean;
  disclaimer?: string | null;
  message?: string;
  error?: string;
};

type LinkResponse = {
  success?: boolean;
  error?: string;
  suggestion?: string;
  data?: {
    title?: string | null;
    description?: string | null;
    image_url?: string | null;
    extracted?: RawExtracted;
    provider_is_real?: boolean;
  };
};

const DEMO_DISCLAIMER = 'Resultados de demostración: el proveedor de IA configurado no es real.';

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

const TYPE_FROM_API: Record<string, NonNullable<ImportedData['type']>> = {
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

/** Limpia un texto y devuelve `undefined` si queda vacío. */
function cleanText(value?: string | null): string | undefined {
  const trimmed = (value ?? '').trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Indica si la extracción aportó algún dato editable.
 *
 * `confidence`, `ocrText` y las coordenadas no cuentan: una revisión vacía solo
 * confunde, así que es mejor pedir otra imagen.
 */
function hasMeaningfulData(data: ImportedData): boolean {
  const ignored = new Set([
    'confidence',
    'sourceUrl',
    'ocrText',
    'locationPrecision',
    'latitude',
    'longitude',
  ]);

  return Object.entries(data).some(
    ([key, value]) =>
      !ignored.has(key) && value !== undefined && value !== '' && value !== false
  );
}

/**
 * Normaliza la respuesta de la API a los enums del formulario.
 *
 * `buildFormExtraction` ya devuelve los enums correctos (`dog`, `small`,
 * `puppy`), pero los endpoints también aceptan claves antiguas en snake_case.
 * Sin esta conversión los selects se quedaban vacíos aunque la IA hubiera
 * detectado el dato.
 */
function normalizeExtracted(raw: RawExtracted | undefined, sourceUrl?: string): ImportedData {
  const api = raw ?? {};
  const phone = cleanText(api.contact_phone ?? api.contactPhone);
  const whatsapp = cleanText(api.contact_whatsapp ?? api.contactWhatsapp);
  const email = cleanText(api.contact_email ?? api.contactEmail);

  return {
    type: mapValue(TYPE_FROM_API, api.type),
    title: cleanText(api.title),
    description: cleanText(api.description),
    species: mapValue(SPECIES_FROM_API, api.species),
    breed: cleanText(api.breed),
    color: cleanText(api.color),
    size: mapValue(SIZE_FROM_API, api.size),
    sex: mapValue(SEX_FROM_API, api.sex),
    ageApprox: mapValue(AGE_FROM_API, api.ageApprox ?? api.age),
    characteristics: cleanText(api.characteristics),
    collar: api.collar,
    plate: api.plate,
    reward: cleanText(api.reward),
    contactMode: phone ? 'PHONE' : whatsapp ? 'WHATSAPP' : email ? 'EMAIL' : undefined,
    contactPhone: phone,
    contactWhatsapp: whatsapp,
    contactEmail: email,
    province: cleanText(api.province),
    municipality: cleanText(api.municipality),
    zone: cleanText(api.zone),
    address: cleanText(api.address),
    latitude: typeof api.latitude === 'number' ? api.latitude : undefined,
    longitude: typeof api.longitude === 'number' ? api.longitude : undefined,
    locationPrecision: api.locationPrecision,
    eventDate: normalizeDateInput(api.event_date ?? api.eventDate),
    eventTimeApprox: normalizeTimeInput(api.event_time ?? api.eventTimeApprox),
    sourceUrl,
    confidence: typeof api.confidence === 'number' ? api.confidence : undefined,
    ocrText: cleanText(api.ocrText),
  };
}

/** Devuelve el JWT de Supabase o lanza un error claro. */
async function getAccessToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  if (!token) {
    throw new Error('Inicia sesión para autocompletar la publicación.');
  }

  return token;
}

type ReviewFieldConfig = {
  key: keyof ImportedData;
  label: string;
  kind: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'time';
  options?: Record<string, string> | readonly string[];
  /** Los campos clave se muestran aunque la IA no los haya detectado. */
  always?: boolean;
  placeholder?: string;
};

const REVIEW_FIELDS: ReviewFieldConfig[] = [
  { key: 'type', label: 'Tipo de aviso', kind: 'select', options: TYPE_LABELS, always: true },
  {
    key: 'title',
    label: 'Título',
    kind: 'text',
    always: true,
    placeholder: 'Perro perdido en Centro Habana',
  },
  { key: 'description', label: 'Descripción', kind: 'textarea', always: true },
  { key: 'species', label: 'Especie', kind: 'select', options: SPECIES_LABELS },
  { key: 'breed', label: 'Raza', kind: 'text' },
  { key: 'color', label: 'Color', kind: 'text' },
  { key: 'size', label: 'Tamaño', kind: 'select', options: SIZE_LABELS },
  { key: 'sex', label: 'Sexo', kind: 'select', options: SEX_LABELS },
  { key: 'ageApprox', label: 'Edad aproximada', kind: 'select', options: AGE_LABELS },
  { key: 'collar', label: 'Lleva collar', kind: 'checkbox' },
  { key: 'plate', label: 'Lleva placa', kind: 'checkbox' },
  { key: 'reward', label: 'Recompensa', kind: 'text' },
  { key: 'contactPhone', label: 'Teléfono', kind: 'text' },
  { key: 'contactWhatsapp', label: 'WhatsApp', kind: 'text' },
  { key: 'contactEmail', label: 'Email', kind: 'text' },
  { key: 'province', label: 'Provincia', kind: 'select', options: PROVINCES, always: true },
  { key: 'municipality', label: 'Municipio', kind: 'text', always: true },
  { key: 'zone', label: 'Zona o barrio', kind: 'text' },
  { key: 'address', label: 'Dirección', kind: 'text' },
  { key: 'eventDate', label: 'Fecha del evento', kind: 'date' },
  { key: 'eventTimeApprox', label: 'Hora aproximada', kind: 'time' },
];

const selectClasses =
  'h-12 w-full rounded-2xl border-2 border-foreground/10 bg-surface px-4 text-base text-foreground shadow-sm outline-none transition focus:border-orange focus:ring-4 focus:ring-orange/20';

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2 text-sm font-semibold text-foreground" htmlFor={id}>
      <span className="block">{label}</span>
      <select
        id={id}
        className={selectClasses}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">No detectado</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

type PublicationImporterProps = {
  onApply: (data: ImportedData) => void;
  disabled?: boolean;
};

/**
 * Bloque único para autocompletar la publicación.
 *
 * La foto o captura es la entrada principal; el enlace de Facebook es una
 * opción secundaria dentro del mismo bloque. Las dos rutas terminan en la
 * misma revisión editable, así el usuario corrige antes de aplicar y nunca se
 * pisa lo que ya había escrito.
 */
export function PublicationImporter({ onApply, disabled }: PublicationImporterProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [importingLink, setImportingLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [review, setReview] = useState<ImportedData | null>(null);
  const [reviewImage, setReviewImage] = useState<string | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  const selectFile = useCallback(
    (selected: File) => {
      if (!ALLOWED_IMAGE_TYPES.includes(selected.type)) {
        setError('Formato no permitido. Usa JPG, PNG o WebP.');
        return;
      }

      if (selected.size > MAX_IMAGE_BYTES) {
        setError('La imagen excede 8 MB.');
        return;
      }

      if (preview) URL.revokeObjectURL(preview);

      setFile(selected);
      setPreview(URL.createObjectURL(selected));
      setReview(null);
      setReviewImage(null);
      setDisclaimer(null);
      setError(null);
      setApplied(false);
    },
    [preview]
  );

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    // Permite volver a elegir el mismo archivo después de quitarlo.
    event.target.value = '';
    if (selected) selectFile(selected);
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    if (disabled) return;

    const selected = event.dataTransfer.files?.[0];
    if (selected) selectFile(selected);
  };

  const clearImage = () => {
    if (preview) URL.revokeObjectURL(preview);
    setFile(null);
    setPreview(null);
    setReview(null);
    setReviewImage(null);
    setDisclaimer(null);
    setError(null);
    setApplied(false);
  };

  const analyzeImage = async () => {
    if (!file) return;

    setAnalyzing(true);
    setError(null);
    setApplied(false);

    try {
      const token = await getAccessToken();
      const image = await fileToDataUrl(file);

      const response = await fetch('/api/ai?action=extract-from-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image }),
      });

      const result = (await response.json().catch(() => null)) as ImageResponse | null;

      if (!response.ok) {
        throw new Error(
          result?.message || result?.error || `Error ${response.status} al analizar la imagen`
        );
      }

      if (!result?.ok || !result.extracted) {
        throw new Error('El servidor no devolvió datos de la imagen.');
      }

      const extracted = normalizeExtracted(result.extracted);

      if (!hasMeaningfulData(extracted)) {
        throw new Error(
          'No se encontraron datos legibles en la imagen. Prueba con una foto más nítida o con el texto del aviso visible.'
        );
      }

      setReview(extracted);
      setReviewImage(preview);
      setDisclaimer(result.provider_is_real ? null : result.disclaimer ?? DEMO_DISCLAIMER);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al analizar la imagen');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleLinkSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLinkError(null);
    setApplied(false);

    const url = link.trim();
    const validation = facebookLinkImportSchema.safeParse({ url });

    if (!validation.success) {
      setLinkError('URL de Facebook inválida. Usa facebook.com, fb.com o fb.watch.');
      return;
    }

    setImportingLink(true);

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

      const result = (await response.json().catch(() => null)) as LinkResponse | null;

      if (!response.ok || !result || result.success === false) {
        const message =
          result?.error || `Error ${response.status} al importar el enlace`;
        throw new Error(
          result?.suggestion === 'UPLOAD_SCREENSHOT'
            ? `${message} También puedes subir una captura del post.`
            : message
        );
      }

      const data = result.data;
      if (!data) {
        throw new Error('El servidor no devolvió datos del enlace');
      }

      const mapped = normalizeExtracted(data.extracted, url);
      const extracted: ImportedData = {
        ...mapped,
        // Lo extraído del texto del post manda; Open Graph solo rellena huecos
        // y nunca aporta los textos genéricos de Facebook.
        title:
          mapped.title ??
          (isFacebookBoilerplate(data.title) ? undefined : cleanText(data.title)),
        description:
          mapped.description ??
          (isFacebookBoilerplate(data.description) ? undefined : cleanText(data.description)),
        sourceUrl: url,
      };

      // La imagen local ya no hace falta: la revisión usa la del enlace.
      if (preview) {
        URL.revokeObjectURL(preview);
        setPreview(null);
        setFile(null);
      }

      setReview(extracted);
      setReviewImage(cleanText(data.image_url) ?? null);
      setDisclaimer(data.provider_is_real === false ? DEMO_DISCLAIMER : null);
      setLinkOpen(false);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : 'Error al importar el enlace');
    } finally {
      setImportingLink(false);
    }
  };

  const updateReview = (key: keyof ImportedData, value: string | boolean) => {
    setReview((current) => {
      if (!current) return current;

      // Al cambiar la provincia, un municipio de otra provincia deja de ser
      // válido. Se limpia para que las coordenadas se resuelvan con el nuevo
      // contexto en vez de conservar un punto de la ubicación anterior.
      if (key === 'province' && typeof value === 'string') {
        const municipalities = CUBA[value as keyof typeof CUBA] ?? [];
        const currentMunicipality =
          typeof current.municipality === 'string' ? current.municipality : '';
        const municipality = municipalities.includes(currentMunicipality)
          ? currentMunicipality
          : '';

        return { ...current, province: value, municipality };
      }

      return { ...current, [key]: value };
    });
  };

  const discardReview = () => {
    setReview(null);
    setReviewImage(null);
    setDisclaimer(null);
    setApplied(false);
  };

  const applyReview = () => {
    if (!review) return;

    onApply(review);
    discardReview();
    setApplied(true);
    setLink('');
    setLinkOpen(false);

    if (preview) {
      URL.revokeObjectURL(preview);
      setPreview(null);
    }
    setFile(null);
  };

  const confidencePercent =
    review?.confidence !== undefined && Number.isFinite(review.confidence)
      ? Math.round(review.confidence * 100)
      : null;

  const visibleFields = review
    ? REVIEW_FIELDS.filter((field) => {
        if (field.always) return true;
        const value = review[field.key];
        if (field.kind === 'checkbox') return value === true;
        return value !== undefined && value !== '';
      })
    : [];

  return (
    <div className="space-y-4 rounded-3xl border-2 border-purple/20 bg-purple/5 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-purple/20 p-2">
          <Sparkles className="size-5 text-purple" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold text-foreground">
            Autocompletar publicación
          </h3>
          <p className="mt-1 text-sm text-foreground/70">
            Sube una foto o una captura del aviso. La IA extrae los datos y los revisas
            antes de aplicarlos.
          </p>
        </div>
      </div>

      {applied && (
        <div className="flex items-center gap-2 rounded-2xl border-2 border-found/20 bg-found/10 px-4 py-3 text-sm font-medium text-found">
          <CheckCircle className="size-5 shrink-0" aria-hidden="true" />
          Datos aplicados al formulario. Revisa y corrige lo que falte.
        </div>
      )}

      {!review ? (
        <div className="space-y-3">
          {!preview ? (
            <label
              className={[
                'block rounded-2xl border-2 border-dashed bg-surface p-8 text-center transition-all',
                dragging
                  ? 'border-purple bg-purple/10'
                  : 'border-purple/30 hover:border-purple hover:bg-purple/5',
                disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
              ].join(' ')}
              onDragOver={(event) => {
                event.preventDefault();
                if (!disabled) setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleFileSelect}
                className="sr-only"
                disabled={disabled}
              />
              <Upload className="size-12 mx-auto text-purple/40 mb-3" aria-hidden="true" />
              <p className="font-semibold text-foreground mb-1">
                Suelta una foto o captura aquí
              </p>
              <p className="text-xs text-foreground/60">
                Cartel, foto de la mascota o captura de Facebook · JPG, PNG o WebP · Máximo 8 MB
              </p>
            </label>
          ) : (
            <div className="space-y-3">
              <div className="relative rounded-2xl overflow-hidden border-2 border-purple/20 max-w-sm mx-auto">
                <img src={preview} alt="Vista previa" className="w-full h-40 object-cover" />
                <button
                  type="button"
                  onClick={clearImage}
                  className="absolute top-2 right-2 rounded-full bg-ink/80 text-white p-2 hover:bg-ink transition backdrop-blur-sm"
                  aria-label="Eliminar imagen"
                  disabled={analyzing}
                >
                  <X className="size-4" />
                </button>
              </div>

              {!analyzing && (
                <Button
                  type="button"
                  onClick={analyzeImage}
                  disabled={disabled}
                  variant="secondary"
                  className="w-full gap-2"
                >
                  <Sparkles className="size-4" aria-hidden="true" />
                  Extraer datos de la imagen
                </Button>
              )}

              {analyzing && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <CatLoader size="md" />
                  <p className="text-sm font-medium text-foreground/70">Analizando imagen...</p>
                </div>
              )}
            </div>
          )}

          <div className="border-t border-purple/15 pt-3">
            <button
              type="button"
              onClick={() => setLinkOpen((open) => !open)}
              className="flex w-full items-center justify-between gap-2 rounded-xl px-1 py-2 text-sm font-semibold text-foreground/70 transition hover:text-foreground"
              aria-expanded={linkOpen}
            >
              <span className="flex items-center gap-2">
                <ExternalLink className="size-4" aria-hidden="true" />
                Tengo un enlace de Facebook
              </span>
              <ChevronDown
                className={`size-4 transition-transform ${linkOpen ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {linkOpen && (
              <form onSubmit={handleLinkSubmit} className="mt-3 space-y-3">
                <TextField
                  label="Enlace del post"
                  placeholder="https://facebook.com/... o https://fb.watch/..."
                  name="facebook-url"
                  type="url"
                  value={link}
                  onChange={(event) => setLink(event.target.value)}
                  error={linkError ?? undefined}
                  hint="Solo enlaces públicos. Facebook puede ocultar el texto del post."
                  disabled={disabled || importingLink}
                  required
                />
                <Button
                  type="submit"
                  variant="secondary"
                  className="w-full"
                  loading={importingLink}
                  disabled={disabled || !link.trim()}
                >
                  <ExternalLink className="size-4" aria-hidden="true" />
                  Importar enlace
                </Button>
              </form>
            )}
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-2xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm">
              <AlertCircle className="size-5 text-lost shrink-0 mt-0.5" aria-hidden="true" />
              <p className="font-medium text-lost-dark">{error}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle className="size-6 text-found" aria-hidden="true" />
              <div>
                <h4 className="font-display text-base font-bold text-foreground">
                  Revisa los datos extraídos
                </h4>
                <p className="text-xs text-foreground/60">
                  Corrige o completa lo que haga falta antes de aplicarlo.
                </p>
              </div>
            </div>
            {confidencePercent !== null && (
              <span className="rounded-full bg-turquoise/20 px-3 py-1 text-xs font-semibold text-turquoise">
                {confidencePercent}% de confianza
              </span>
            )}
          </div>

          {disclaimer && (
            <div className="flex items-start gap-2 rounded-xl bg-orange/10 border border-orange/30 px-3 py-2">
              <AlertCircle className="size-4 text-orange shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs font-medium text-foreground/80">{disclaimer}</p>
            </div>
          )}

          {reviewImage && (
            <div className="relative rounded-xl overflow-hidden border-2 border-foreground/10 max-w-sm mx-auto">
              <img
                src={reviewImage}
                alt="Imagen importada"
                className="w-full h-40 object-cover"
              />
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {visibleFields.map((field) => {
              const value = review[field.key];
              const inputId = `import-${field.key}`;

              if (field.kind === 'checkbox') {
                return (
                  <label
                    key={field.key}
                    className="flex items-center gap-2 self-end rounded-2xl border-2 border-foreground/10 bg-surface px-4 py-3 text-sm font-semibold text-foreground"
                  >
                    <input
                      type="checkbox"
                      className="size-4 rounded border-foreground/20"
                      checked={value === true}
                      onChange={(event) => updateReview(field.key, event.target.checked)}
                    />
                    {field.label}
                  </label>
                );
              }

              if (field.key === 'municipality' && typeof review.province === 'string' && review.province) {
                const municipalities = CUBA[review.province as keyof typeof CUBA] ?? [];
                const currentValue = typeof value === 'string' ? value : '';
                const options = municipalities.map((name) => ({ value: name, label: name }));

                // Un valor no canónico se conserva para que el usuario decida.
                if (currentValue && !municipalities.includes(currentValue)) {
                  options.unshift({ value: currentValue, label: currentValue });
                }

                return (
                  <SelectField
                    key={field.key}
                    id={inputId}
                    label={field.label}
                    value={currentValue}
                    options={options}
                    onChange={(next) => updateReview(field.key, next)}
                  />
                );
              }

              if (field.kind === 'select') {
                const options = Array.isArray(field.options)
                  ? field.options.map((option) => ({ value: option, label: option }))
                  : Object.entries(field.options ?? {}).map(([optionValue, label]) => ({
                      value: optionValue,
                      label,
                    }));

                return (
                  <SelectField
                    key={field.key}
                    id={inputId}
                    label={field.label}
                    value={typeof value === 'string' ? value : ''}
                    options={options}
                    onChange={(next) => updateReview(field.key, next)}
                  />
                );
              }

              if (field.kind === 'textarea') {
                return (
                  <TextareaField
                    key={field.key}
                    className="sm:col-span-2"
                    label={field.label}
                    name={inputId}
                    value={typeof value === 'string' ? value : ''}
                    onChange={(event) => updateReview(field.key, event.target.value)}
                    placeholder="Lo que dice el aviso"
                  />
                );
              }

              return (
                <TextField
                  key={field.key}
                  label={field.label}
                  name={inputId}
                  type={field.kind === 'date' ? 'date' : field.kind === 'time' ? 'time' : 'text'}
                  value={typeof value === 'string' ? value : ''}
                  onChange={(event) => updateReview(field.key, event.target.value)}
                  placeholder={field.placeholder}
                />
              );
            })}
          </div>

          {review.ocrText && (
            <details className="rounded-xl border border-foreground/10 bg-surface/70 px-3 py-2">
              <summary className="cursor-pointer text-sm font-medium text-foreground/70">
                Texto detectado en la imagen
              </summary>
              <p className="mt-2 max-h-32 overflow-y-auto whitespace-pre-wrap text-xs text-foreground/70">
                {review.ocrText}
              </p>
            </details>
          )}

          {review.sourceUrl && (
            <div className="rounded-xl border border-border bg-secondary/40 px-4 py-3">
              <p className="mb-1 text-sm font-medium text-foreground">Fuente original</p>
              <a
                href={safeLinkUrl(review.sourceUrl) ?? undefined}
                target="_blank"
                rel="noopener noreferrer nofollow ugc"
                className="flex items-center gap-2 text-sm text-orange hover:underline"
              >
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Ver post en Facebook
              </a>
            </div>
          )}

          <div className="flex flex-col gap-3 border-t border-foreground/10 pt-4 sm:flex-row">
            <Button variant="secondary" onClick={discardReview} className="flex-1">
              Descartar
            </Button>
            <Button onClick={applyReview} className="flex-1">
              Aplicar al formulario
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-1 rounded-2xl border border-purple/20 bg-purple/10 px-4 py-3 text-xs text-foreground/60">
        <p className="font-semibold">Cómo funciona:</p>
        <ul className="list-disc space-y-1 pl-4">
          <li>La IA lee el cartel, la foto o el texto del post y solo aporta datos reales.</li>
          <li>Si un dato no aparece, queda vacío para que lo completes tú.</li>
          <li>La imagen no se guarda: solo se usa para extraer información.</li>
          <li>Al aplicar, se respeta lo que ya habías escrito en el formulario.</li>
        </ul>
      </div>

      {error && review && (
        <div className="flex items-start gap-2 rounded-2xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm">
          <AlertCircle className="size-5 text-lost shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-medium text-lost-dark">{error}</p>
        </div>
      )}

      {!review && !preview && !file && (
        <div className="flex items-center gap-2 text-xs text-foreground/50">
          <ImageIcon className="size-3.5" aria-hidden="true" />
          También sirve una captura de pantalla del post de Facebook.
        </div>
      )}
    </div>
  );
}

export default PublicationImporter;
