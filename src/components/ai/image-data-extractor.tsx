import { useState, type ChangeEvent } from 'react';
import { Sparkles, Upload, X, AlertCircle, Info } from 'lucide-react';
import { Button } from '../ui/button';
import { CatLoader } from '../ui/cat-loader';
import { supabase } from '../../lib/supabase/client';
import { AGE_LABELS, SEX_LABELS, SIZE_LABELS, SPECIES_LABELS } from '../../lib/constants/labels';

type ExtractedData = {
  // Datos del animal
  species?: string;
  breed?: string;
  sex?: string;
  size?: string;
  ageApprox?: string;
  color?: string;
  characteristics?: string;
  collar?: boolean;
  plate?: boolean;
  
  // Datos contextuales extraídos de texto en la imagen
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
  
  // Metadatos
  confidence: number;
  hasTextOverlay?: boolean; // Indica si detectó texto en la imagen
  petName?: string;
  ocrText?: string;
};

/** Respuesta de `/api/ai?action=extract-from-image`. */
type ExtractResponse = {
  ok: boolean;
  extracted: ExtractedData;
  provider_is_real: boolean;
  disclaimer: string | null;
};

/** Muestra el valor legible de un enum del formulario (dog -> Perro). */
function labelFor(labels: Record<string, string>, value: string | undefined): string | undefined {
  if (!value) return undefined;
  return labels[value] ?? value;
}

type ImageDataExtractorProps = {
  onDataExtracted: (data: ExtractedData) => void;
  disabled?: boolean;
};

export function ImageDataExtractor({ onDataExtracted, disabled }: ImageDataExtractorProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null);
  const [disclaimer, setDisclaimer] = useState<string | null>(null);

  const handleFileSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(selectedFile.type)) {
      setError('Formato no permitido. Usa JPG, PNG o WebP.');
      return;
    }

    // Validar tamaño (8 MB)
    const maxSize = 8 * 1024 * 1024;
    if (selectedFile.size > maxSize) {
      setError('La imagen excede 8 MB.');
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setError(null);
    setExtractedData(null);
    setDisclaimer(null);
  };

  const handleExtract = async () => {
    if (!file) return;

    setProcessing(true);
    setError(null);

    try {
      // El endpoint exige sesión: se envía el JWT de Supabase en el header.
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        throw new Error('Inicia sesión para usar el asistente de IA.');
      }

      // Convertir el archivo a base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const base64Image = await base64Promise;

      // Enviar la imagen al endpoint
      const response = await fetch('/api/ai?action=extract-from-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ image: base64Image }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.error || 'No se pudo procesar la imagen'
        );
      }

      const data: ExtractResponse = await response.json();

      if (!data.ok || !data.extracted) {
        throw new Error('El servidor no devolvió datos de la imagen.');
      }

      setExtractedData(data.extracted);
      setDisclaimer(data.provider_is_real ? null : data.disclaimer);
      onDataExtracted(data.extracted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al procesar la imagen');
    } finally {
      setProcessing(false);
    }
  };

  const handleClear = () => {
    if (preview) {
      URL.revokeObjectURL(preview);
    }
    setFile(null);
    setPreview(null);
    setError(null);
    setExtractedData(null);
    setDisclaimer(null);
  };

  return (
    <div className="space-y-4 rounded-3xl border-2 border-purple/20 bg-purple/5 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-purple/20 p-2">
          <Sparkles className="size-5 text-purple" aria-hidden="true" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-lg font-bold text-foreground">
            Asistente IA para Formulario
          </h3>
          <p className="mt-1 text-sm text-foreground/70">
            Sube una imagen del animal y la IA extraerá automáticamente los datos para rellenar el formulario.
          </p>
        </div>
      </div>

      {!preview ? (
        <label
          className={[
            'block rounded-2xl border-2 border-dashed border-purple/30 bg-surface p-8 text-center cursor-pointer transition-all hover:border-purple hover:bg-purple/5',
            disabled ? 'opacity-50 cursor-not-allowed' : '',
          ].join(' ')}
        >
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileSelect}
            className="sr-only"
            disabled={disabled}
          />
          <Upload className="size-12 mx-auto text-purple/40 mb-3" aria-hidden="true" />
          <p className="font-semibold text-foreground mb-1">Haz clic para seleccionar una imagen</p>
          <p className="text-xs text-foreground/60">JPG, PNG o WebP • Máximo 8 MB</p>
        </label>
      ) : (
        <div className="space-y-3">
          <div className="relative rounded-2xl overflow-hidden border-2 border-purple/20 max-w-xs mx-auto">
            <img src={preview} alt="Vista previa" className="w-full h-24 object-cover" />
            <button
              type="button"
              onClick={handleClear}
              className="absolute top-2 right-2 rounded-full bg-ink/80 text-white p-2 hover:bg-ink transition backdrop-blur-sm"
              aria-label="Eliminar imagen"
              disabled={processing}
            >
              <X className="size-4" />
            </button>
          </div>

          {!extractedData && !processing && (
            <Button
              type="button"
              onClick={handleExtract}
              disabled={processing || disabled}
              variant="secondary"
              className="w-full gap-2"
            >
              <Sparkles className="size-4" aria-hidden="true" />
              Extraer datos con IA
            </Button>
          )}

          {processing && (
            <div className="flex flex-col items-center gap-3 py-4">
              <CatLoader size="md" />
              <p className="text-sm font-medium text-foreground/70">Analizando imagen...</p>
            </div>
          )}

          {extractedData && (
            <div className="space-y-3 rounded-2xl bg-turquoise/10 border-2 border-turquoise/20 p-4">
              <div className="flex items-center gap-2">
                <div className="rounded-full bg-turquoise/20 p-1">
                  <Sparkles className="size-4 text-turquoise" aria-hidden="true" />
                </div>
                <h4 className="font-semibold text-foreground">Datos extraídos</h4>
                <span className="ml-auto text-xs font-semibold text-turquoise">
                  {Math.round((Number.isFinite(extractedData.confidence) ? extractedData.confidence : 0) * 100)}% confianza
                </span>
              </div>

              {disclaimer && (
                <div className="flex items-start gap-2 rounded-xl bg-orange/10 border border-orange/30 px-3 py-2">
                  <Info className="size-4 text-orange shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="text-xs font-medium text-foreground/80">{disclaimer}</p>
                </div>
              )}

              <dl className="grid gap-2 text-sm">
                {extractedData.petName && (
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Nombre:</dt>
                    <dd className="font-semibold text-foreground">{extractedData.petName}</dd>
                  </div>
                )}
                {extractedData.species && (
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Especie:</dt>
                    <dd className="font-semibold text-foreground">
                      {labelFor(SPECIES_LABELS, extractedData.species)}
                    </dd>
                  </div>
                )}
                {extractedData.breed && (
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Raza:</dt>
                    <dd className="font-semibold text-foreground">{extractedData.breed}</dd>
                  </div>
                )}
                {extractedData.color && (
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Color:</dt>
                    <dd className="font-semibold text-foreground">{extractedData.color}</dd>
                  </div>
                )}
                {extractedData.size && (
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Tamaño:</dt>
                    <dd className="font-semibold text-foreground">
                      {labelFor(SIZE_LABELS, extractedData.size)}
                    </dd>
                  </div>
                )}
                {extractedData.sex && (
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Sexo:</dt>
                    <dd className="font-semibold text-foreground">
                      {labelFor(SEX_LABELS, extractedData.sex)}
                    </dd>
                  </div>
                )}
                {extractedData.ageApprox && (
                  <div className="flex justify-between">
                    <dt className="text-foreground/60">Edad aproximada:</dt>
                    <dd className="font-semibold text-foreground">
                      {labelFor(AGE_LABELS, extractedData.ageApprox)}
                    </dd>
                  </div>
                )}
                {extractedData.characteristics && (
                  <div className="flex flex-col gap-1">
                    <dt className="text-foreground/60">Características:</dt>
                    <dd className="text-foreground">{extractedData.characteristics}</dd>
                  </div>
                )}
                
                {/* Datos contextuales extraídos de texto */}
                {(extractedData.province || extractedData.municipality || extractedData.zone) && (
                  <div className="col-span-full pt-2 border-t border-turquoise/20">
                    <p className="text-xs font-semibold text-foreground/60 mb-2">📍 Ubicación extraída:</p>
                    {extractedData.province && (
                      <div className="flex justify-between">
                        <dt className="text-foreground/60">Provincia:</dt>
                        <dd className="font-semibold text-foreground">{extractedData.province}</dd>
                      </div>
                    )}
                    {extractedData.municipality && (
                      <div className="flex justify-between">
                        <dt className="text-foreground/60">Municipio:</dt>
                        <dd className="font-semibold text-foreground">{extractedData.municipality}</dd>
                      </div>
                    )}
                    {extractedData.zone && (
                      <div className="flex justify-between">
                        <dt className="text-foreground/60">Zona:</dt>
                        <dd className="font-semibold text-foreground">{extractedData.zone}</dd>
                      </div>
                    )}
                  </div>
                )}
                
                {(extractedData.eventDate || extractedData.eventTimeApprox) && (
                  <div className="col-span-full pt-2 border-t border-turquoise/20">
                    <p className="text-xs font-semibold text-foreground/60 mb-2">📅 Fecha extraída:</p>
                    {extractedData.eventDate && (
                      <div className="flex justify-between">
                        <dt className="text-foreground/60">Fecha:</dt>
                        <dd className="font-semibold text-foreground">{extractedData.eventDate}</dd>
                      </div>
                    )}
                    {extractedData.eventTimeApprox && (
                      <div className="flex justify-between">
                        <dt className="text-foreground/60">Hora:</dt>
                        <dd className="font-semibold text-foreground">{extractedData.eventTimeApprox}</dd>
                      </div>
                    )}
                  </div>
                )}
                
                {(extractedData.contactPhone || extractedData.contactWhatsapp || extractedData.contactEmail) && (
                  <div className="col-span-full pt-2 border-t border-turquoise/20">
                    <p className="text-xs font-semibold text-foreground/60 mb-2">📞 Contacto extraído:</p>
                    {extractedData.contactPhone && (
                      <div className="flex justify-between">
                        <dt className="text-foreground/60">Teléfono:</dt>
                        <dd className="font-semibold text-foreground">{extractedData.contactPhone}</dd>
                      </div>
                    )}
                    {extractedData.contactWhatsapp && (
                      <div className="flex justify-between">
                        <dt className="text-foreground/60">WhatsApp:</dt>
                        <dd className="font-semibold text-foreground">{extractedData.contactWhatsapp}</dd>
                      </div>
                    )}
                    {extractedData.contactEmail && (
                      <div className="flex justify-between">
                        <dt className="text-foreground/60">Email:</dt>
                        <dd className="font-semibold text-foreground">{extractedData.contactEmail}</dd>
                      </div>
                    )}
                  </div>
                )}
                
                {extractedData.reward && (
                  <div className="flex justify-between pt-2 border-t border-turquoise/20">
                    <dt className="text-foreground/60">💰 Recompensa:</dt>
                    <dd className="font-semibold text-foreground">{extractedData.reward}</dd>
                  </div>
                )}
                
                {(extractedData.collar || extractedData.plate) && (
                  <div className="flex gap-2 flex-wrap pt-2">
                    {extractedData.collar && (
                      <span className="text-xs font-semibold bg-turquoise/20 text-turquoise px-3 py-1 rounded-full">
                        Collar detectado
                      </span>
                    )}
                    {extractedData.plate && (
                      <span className="text-xs font-semibold bg-purple/20 text-purple px-3 py-1 rounded-full">
                        Placa detectada
                      </span>
                    )}
                  </div>
                )}

                {extractedData.ocrText && (
                  <div className="col-span-full pt-2 border-t border-turquoise/20">
                    <dt className="text-foreground/60 mb-1">Texto detectado en la imagen:</dt>
                    <dd className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface/70 p-2 text-xs text-foreground/80">
                      {extractedData.ocrText}
                    </dd>
                  </div>
                )}
              </dl>

              <p className="text-xs text-foreground/60 pt-2 border-t border-turquoise/20">
                Los datos han sido rellenados en el formulario. Revísalos y edítalos si es necesario antes de publicar.
              </p>
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-2xl bg-lost/10 border-2 border-lost/20 px-4 py-3 text-sm">
          <AlertCircle className="size-5 text-lost shrink-0 mt-0.5" aria-hidden="true" />
          <p className="font-medium text-lost-dark">{error}</p>
        </div>
      )}

      <div className="text-xs text-foreground/60 bg-purple/10 border border-purple/20 rounded-2xl px-4 py-3 space-y-1">
        <p className="font-semibold">Cómo funciona:</p>
        <ul className="space-y-1 pl-4 list-disc">
          <li>La IA analiza la imagen y detecta características del animal</li>
          <li>Si hay texto visible (cartel, letrero), extrae datos como dirección, teléfono, fecha y recompensa</li>
          <li>Los datos se rellenan automáticamente en el formulario</li>
          <li>Revisa y corrige cualquier dato antes de publicar</li>
          <li>La imagen no se guarda, solo se usa para extraer información</li>
        </ul>
      </div>
    </div>
  );
}
