import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ExternalLink, Image, Loader2, AlertCircle, CheckCircle, X, Globe } from 'lucide-react';
import { Button } from '../ui/button';
import { TextField } from '../ui/text-field';
import { facebookLinkImportSchema } from '../../lib/validations/facebook-import';
import type { PublicationFormValues } from '../../lib/validations/publication';
import { PROVINCES } from '../../lib/constants/cuba';
import { SPECIES_LABELS, SEX_LABELS, SIZE_LABELS, AGE_LABELS } from '../../lib/constants/labels';

type ImportTab = 'link' | 'screenshot';

type ExtractedData = {
  type?: 'LOST' | 'FOUND' | 'ADOPTION' | 'ABANDONED';
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
  eventDate?: string;
  eventTimeApprox?: string;
  confidence: Record<string, number>;
  sourceUrl?: string;
};

type ExtractedApiData = {
  type?: 'LOST' | 'FOUND' | 'ADOPTION' | 'ABANDONED';
  title?: string;
  description?: string;
  species?: string;
  breed?: string;
  color?: string;
  size?: 'PEQUENO' | 'MEDIANO' | 'GRANDE';
  sex?: 'MACHO' | 'HEMBRA';
  collar?: boolean;
  plate?: boolean;
  province?: string;
  municipality?: string;
  zone?: string;
  event_date?: string;
  contact_phone?: string;
  contact_whatsapp?: string;
  contact_email?: string;
  reward?: string;
  confidence?: Record<string, number>;
};


function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.7) return 'text-green-600';
  if (confidence >= 0.4) return 'text-yellow-600';
  return 'text-red-600';
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
      const token = localStorage.getItem('sb-access-token') ?? '';
      const response = await fetch('/api/import/facebook-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url }),
      });
      const result = await response.json();
      // Convertir datos extraídos a nuestro formato
      const data = result.data;
      const apiExtracted = data.extracted as ExtractedApiData | undefined;
      const extracted: ExtractedData = {
        title: data.title ?? undefined,
        species: apiExtracted?.species,
        breed: apiExtracted?.breed,
        color: apiExtracted?.color,
        size: apiExtracted?.size,
        sex: apiExtracted?.sex,
        collar: apiExtracted?.collar ?? false,
        plate: apiExtracted?.plate ?? false,
        reward: apiExtracted?.reward,
        contactPhone: apiExtracted?.contact_phone,
        contactWhatsapp: apiExtracted?.contact_whatsapp,
        contactEmail: apiExtracted?.contact_email,
        province: apiExtracted?.province,
        municipality: apiExtracted?.municipality,
        zone: apiExtracted?.zone,
        eventDate: apiExtracted?.event_date,
        confidence: apiExtracted?.confidence ?? {},
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
      const token = localStorage.getItem('sb-access-token') ?? '';
      const uploadFormData = new FormData();
      uploadFormData.append('image', file);
      
      const response = await fetch('/api/import/facebook-screenshot', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: uploadFormData,
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Error procesando imagen');
      }
      const apiExtracted = result.data?.extracted as ExtractedApiData | undefined;
      const extracted: ExtractedData = {
        type: apiExtracted?.type,
        title: apiExtracted?.title,
        description: apiExtracted?.description,
        species: apiExtracted?.species,
        breed: apiExtracted?.breed,
        color: apiExtracted?.color,
        size: apiExtracted?.size,
        sex: apiExtracted?.sex,
        collar: apiExtracted?.collar ?? false,
        plate: apiExtracted?.plate ?? false,
        reward: apiExtracted?.reward,
        contactPhone: apiExtracted?.contact_phone,
        contactWhatsapp: apiExtracted?.contact_whatsapp,
        contactEmail: apiExtracted?.contact_email,
        province: apiExtracted?.province,
        municipality: apiExtracted?.municipality,
        zone: apiExtracted?.zone,
        eventDate: apiExtracted?.event_date,
        confidence: apiExtracted?.confidence ?? {},
        sourceUrl: undefined,
      };
      
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
      species: extractedData.species ?? 'Perro',
      breed: extractedData.breed ?? '',
      sex: (extractedData.sex as PublicationFormValues['sex']) ?? '',
      size: (extractedData.size as PublicationFormValues['size']) ?? '',
      ageApprox: '',
      color: extractedData.color ?? '',
      characteristics: '',
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
      zone: extractedData.zone ?? '',
      approximateLat: '',
      approximateLng: '',
      eventDate: extractedData.eventDate ?? '',
      eventTimeApprox: '',
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
            <Globe className="size-8 text-blue-600" />
            <h2 className="font-display text-2xl font-bold text-navy">Importar desde Facebook</h2>
          </div>
          <p className="text-navy/60">
            Pega un enlace público de Facebook o sube una captura de pantalla.
            La IA extraerá la información para pre-llenar el formulario.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex bg-navy/5 rounded-xl p-1" role="tablist">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-navy shadow-md'
                  : 'text-navy/60 hover:text-navy'
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
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="size-4" />
                  <span>{error}</span>
                  {error.includes('login') && <span className="text-navy/50">→ Prueba subiendo una captura</span>}
                </div>
              )}
            </form>
          )}

          {activeTab === 'screenshot' && (
            <form onSubmit={handleScreenshotSubmit} className="space-y-4">
              <div className="border-2 border-dashed border-navy/20 rounded-2xl p-6 text-center hover:border-primary/50 transition-colors">
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
                  <Image className="size-12 text-navy/30" />
                  <span className="font-medium text-navy">Sube una captura de pantalla</span>
                  <span className="text-sm text-navy/50">JPG, PNG, WebP · Máx 8MB</span>
                </label>
              </div>
              {imagePreview && (
                <div className="relative rounded-xl overflow-hidden border-2 border-navy/10">
                  <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover" />
                  <button
                    type="button"
                    onClick={() => { setImagePreview(null); URL.revokeObjectURL(imagePreview); }}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600"
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
                <div className="flex items-center gap-2 text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">
                  <AlertCircle className="size-4" />
                  <span>{error}</span>
                </div>
              )}
            </form>
          )}

          {/* Info box */}
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <div className="flex items-start gap-3">
              <span className="size-8 rounded-lg bg-blue-100 flex items-center justify-center">
                <Globe className="size-4 text-blue-600" />
              </span>
              <div className="text-sm text-navy/70 space-y-1">
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
          <CheckCircle className="size-8 text-green-600" />
          <div>
            <h2 className="font-display text-xl font-bold text-navy">Datos extraídos</h2>
            <p className="text-sm text-navy/60">Revisa y corrige antes de continuar al formulario</p>
          </div>
        </div>
        <Button variant="ghost" onClick={handleCancel}>
          <X className="size-4" />
          Cancelar
        </Button>
      </div>

      {/* Image preview */}
      {imagePreview && (
        <div className="relative rounded-xl overflow-hidden border-2 border-navy/10 max-w-md mx-auto">
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
            <div key={field.key} className="bg-white/50 rounded-xl p-4 border border-navy/10">
              <label className="block text-xs font-semibold text-navy/60 mb-1 flex items-center gap-1">
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
              <div className="font-medium text-navy min-h-[1.5rem]">
                {field.type === 'boolean' ? (
                  value ? (
                    <span className="inline-flex items-center gap-1 text-green-600">
                      <CheckCircle className="size-3.5" /> Sí
                    </span>
                  ) : (
                    <span className="text-navy/40">No detectado</span>
                  )
                ) : (
                  value ?? <span className="text-navy/30 italic">No detectado</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Source URL */}
      {extractedData.sourceUrl && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
          <p className="text-sm font-medium text-blue-800 mb-1">Fuente original</p>
          <a href={extractedData.sourceUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-blue-600 hover:underline text-sm">
            <ExternalLink className="size-3.5" />
            Ver post en Facebook
          </a>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-4 border-t border-navy/10">
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