import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase/client';

type ExtractedData = {
  species?: string;
  breed?: string;
  color?: string;
  size?: string;
  sex?: string;
  age?: string;
  collar?: boolean;
  plate?: boolean;
  characteristics?: string;
  phone?: string;
  whatsapp?: string;
  location?: string;
  province?: string;
  municipality?: string;
  date?: string;
  time?: string;
  reward?: string;
  petName?: string;
  ocrText?: string;
  visionDescription?: string;
  confidence?: {
    ocr: number;
    vision: number;
  };
};

type ImageAnalyzerButtonProps = {
  imageUrl: string;
  onDataExtracted: (data: ExtractedData) => void;
  disabled?: boolean;
};

export function ImageAnalyzerButton({ imageUrl, onDataExtracted, disabled }: ImageAnalyzerButtonProps) {
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setError(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('Debes iniciar sesión para usar esta función');
      }

      const response = await fetch('/api/ai/extract-from-image', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al analizar la imagen');
      }

      const { extracted } = await response.json();
      onDataExtracted(extracted);
    } catch (err) {
      console.error('Error analyzing image:', err);
      setError(err instanceof Error ? err.message : 'Error al analizar la imagen');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleAnalyze}
        disabled={disabled || analyzing}
        variant="secondary"
        className="w-full gap-2"
      >
        {analyzing ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Analizando imagen...
          </>
        ) : (
          <>
            <Sparkles className="size-4" />
            Analizar con IA
          </>
        )}
      </Button>

      {error && (
        <p className="text-sm text-lost rounded-xl bg-lost/10 border border-lost/20 px-3 py-2">
          {error}
        </p>
      )}

      {!analyzing && !error && (
        <p className="text-xs text-foreground/60 text-center">
          La IA extraerá información de la imagen automáticamente
        </p>
      )}
    </div>
  );
}
