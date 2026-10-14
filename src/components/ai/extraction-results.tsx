import { Check, X, Info } from 'lucide-react';
import { Button } from '../ui/button';

type ExtractedField = {
  field: string;
  label: string;
  value: string | boolean | null | undefined;
  confidence?: number;
  type: 'text' | 'boolean' | 'select';
};

type ExtractionResultsProps = {
  fields: ExtractedField[];
  onAccept: (field: string, value: string | boolean) => void;
  onReject: (field: string) => void;
  confidence?: {
    ocr?: number;
    vision?: number;
  };
};

export function ExtractionResults({ fields, onAccept, onReject, confidence }: ExtractionResultsProps) {
  const fieldsWithData = fields.filter(f => f.value !== null && f.value !== undefined && f.value !== '');

  if (fieldsWithData.length === 0) {
    return (
      <div className="rounded-2xl border-2 border-navy/10 bg-navy/5 p-4">
        <div className="flex items-start gap-3">
          <Info className="size-5 text-navy/60 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-navy">No se detectó información adicional</p>
            <p className="text-sm text-navy/70 mt-1">
              La imagen puede no tener texto visible o características claras. Completa el formulario manualmente.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header con confianza */}
      <div className="rounded-2xl border-2 border-turquoise/20 bg-turquoise/5 p-4">
        <h3 className="font-display font-bold text-navy mb-2 flex items-center gap-2">
          <Info className="size-5 text-turquoise" />
          Información detectada por IA
        </h3>
        <p className="text-sm text-navy/70 mb-3">
          Revisa y acepta los campos que sean correctos. Puedes editar o rechazar cualquiera.
        </p>
        
        {confidence && (
          <div className="flex gap-4 text-xs">
            {confidence.ocr !== undefined && confidence.ocr > 0 && (
              <div>
                <span className="text-navy/60">OCR: </span>
                <span className="font-semibold text-navy">{Math.round(confidence.ocr * 100)}%</span>
              </div>
            )}
            {confidence.vision !== undefined && confidence.vision > 0 && (
              <div>
                <span className="text-navy/60">Visión: </span>
                <span className="font-semibold text-navy">{Math.round(confidence.vision * 100)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Campos detectados */}
      <div className="space-y-3">
        {fieldsWithData.map((field) => (
          <div
            key={field.field}
            className="rounded-2xl border-2 border-orange/20 bg-white p-4 flex items-start gap-3"
          >
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-wider text-navy/60 mb-1">
                {field.label}
              </p>
              
              {field.type === 'boolean' ? (
                <p className="font-semibold text-navy">
                  {field.value ? 'Sí' : 'No'}
                </p>
              ) : (
                <p className="font-semibold text-navy break-words">
                  {String(field.value)}
                </p>
              )}

              {field.confidence !== undefined && (
                <p className="text-xs text-navy/50 mt-1">
                  Confianza: {Math.round(field.confidence * 100)}%
                </p>
              )}
            </div>

            <div className="flex gap-2 shrink-0">
              <Button
                type="button"
                onClick={() => onAccept(field.field, field.value as string | boolean)}
                variant="secondary"
                className="size-9 p-0 bg-found hover:bg-found-dark text-white"
                title="Aceptar"
              >
                <Check className="size-4" />
              </Button>
              <Button
                type="button"
                onClick={() => onReject(field.field)}
                variant="ghost"
                className="size-9 p-0 text-lost hover:bg-lost/10"
                title="Rechazar"
              >
                <X className="size-4" />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {/* Footer con acciones masivas */}
      <div className="flex gap-3">
        <Button
          type="button"
          onClick={() => {
            fieldsWithData.forEach(field => {
              if (field.value !== null && field.value !== undefined) {
                onAccept(field.field, field.value as string | boolean);
              }
            });
          }}
          variant="secondary"
          className="flex-1"
        >
          Aceptar todo
        </Button>
        <Button
          type="button"
          onClick={() => {
            fieldsWithData.forEach(field => onReject(field.field));
          }}
          variant="ghost"
          className="flex-1"
        >
          Rechazar todo
        </Button>
      </div>
    </div>
  );
}
