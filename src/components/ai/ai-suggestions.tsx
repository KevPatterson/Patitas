import { useEffect, useState } from 'react';
import { Sparkles, Check, X } from 'lucide-react';
import { getExtractedAttributes, createSuggestions, type AttributeSuggestion } from '../../lib/ai/processing';
import { Button } from '../ui/button';

type AISuggestionsProps = {
  publicationId: string;
  onApplySuggestion?: (field: string, value: string) => void;
  threshold?: number;
};

export function AISuggestions({ publicationId, onApplySuggestion, threshold = 0.7 }: AISuggestionsProps) {
  const [suggestions, setSuggestions] = useState<AttributeSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [appliedFields, setAppliedFields] = useState<Set<string>>(new Set());

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const attributes = await getExtractedAttributes(publicationId);
        if (mounted && attributes.length > 0) {
          const suggs = createSuggestions(attributes, threshold);
          setSuggestions(suggs);
        }
      } catch (error) {
        console.error('Error loading AI suggestions:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      mounted = false;
    };
  }, [publicationId, threshold]);

  if (loading || suggestions.length === 0) {
    return null;
  }

  const handleApply = (suggestion: AttributeSuggestion) => {
    onApplySuggestion?.(suggestion.field, suggestion.value);
    setAppliedFields((prev) => new Set(prev).add(suggestion.field));
  };

  const handleDismiss = (field: string) => {
    setSuggestions((prev) => prev.filter((s) => s.field !== field));
  };

  return (
    <div className="rounded-xl border-2 border-turquoise/20 bg-turquoise/5 p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        <Sparkles className="size-4 text-turquoise" />
        <h3 className="font-display text-sm font-bold text-foreground">Sugerencias de IA</h3>
        <span className="ml-auto rounded-full bg-turquoise/20 px-2 py-0.5 text-xs font-bold text-turquoise-dark">
          {suggestions.length}
        </span>
      </div>

      <div className="space-y-2">
        {suggestions.map((suggestion) => {
          const isApplied = appliedFields.has(suggestion.field);

          return (
            <div
              key={suggestion.field}
              className={`rounded-lg border p-3 transition ${
                isApplied
                  ? 'border-found/20 bg-found/5'
                  : 'border-foreground/10 bg-surface hover:border-turquoise/30'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-semibold text-foreground/60 uppercase tracking-wider">
                      {getFieldLabel(suggestion.field)}
                    </span>
                    <span className="text-xs text-foreground/40">
                      {Math.round(suggestion.confidence * 100)}% confianza
                    </span>
                  </div>
                  <p className="font-medium text-foreground truncate">{suggestion.value}</p>
                  <p className="text-xs text-foreground/50 mt-1">Fuente: {getSourceLabel(suggestion.source)}</p>
                </div>

                {isApplied ? (
                  <div className="flex items-center gap-1 rounded-full bg-found/20 px-2 py-1 text-xs font-bold text-found">
                    <Check className="size-3" />
                    Aplicado
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      onClick={() => handleApply(suggestion)}
                      className="h-8 px-3 text-xs gap-1 bg-turquoise/10 hover:bg-turquoise/20 text-turquoise-dark font-semibold"
                    >
                      <Check className="size-3" />
                      Aplicar
                    </Button>
                    <Button
                      variant="ghost"
                      onClick={() => handleDismiss(suggestion.field)}
                      className="h-8 w-8 p-0 text-foreground/40 hover:text-lost hover:bg-lost/10"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="mt-3 text-xs text-foreground/60 leading-relaxed">
        💡 Estas sugerencias fueron extraídas automáticamente. Revisa y confirma antes de aplicar.
      </p>
    </div>
  );
}

function getFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    species: 'Especie',
    breed: 'Raza',
    color: 'Color',
    sex: 'Sexo',
    size: 'Tamaño',
    collar: 'Collar',
    plate: 'Placa',
    contactPhone: 'Teléfono',
    contactWhatsapp: 'WhatsApp',
    contactEmail: 'Email',
    petName: 'Nombre',
  };
  return labels[field] || field;
}

function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    vision: 'Análisis visual',
    ocr: 'Texto en imagen',
    hybrid: 'Análisis combinado',
  };
  return labels[source] || source;
}
