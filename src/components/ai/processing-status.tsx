import { useEffect, useState } from 'react';
import { Loader2, CheckCircle2, XCircle, AlertCircle, Clock } from 'lucide-react';
import { getProcessingStatus, subscribeToProcessingStatus, type ProcessingStatus } from '../../lib/ai/processing';

type ProcessingStatusBadgeProps = {
  publicationId: string;
  onStatusChange?: (status: ProcessingStatus) => void;
};

export function ProcessingStatusBadge({ publicationId, onStatusChange }: ProcessingStatusBadgeProps) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const currentStatus = await getProcessingStatus(publicationId);
        if (mounted) {
          setStatus(currentStatus);
          onStatusChange?.(currentStatus);
        }
      } catch (error) {
        console.error('Error loading processing status:', error);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    load();

    // Suscribirse a cambios en tiempo real
    const unsubscribe = subscribeToProcessingStatus(publicationId, (newStatus) => {
      if (mounted) {
        setStatus(newStatus);
        onStatusChange?.(newStatus);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [publicationId, onStatusChange]);

  if (loading || !status) {
    return null;
  }

  // No mostrar si todo está pendiente
  if (status.overall === 'pending') {
    return null;
  }

  return (
    <div className="rounded-xl border-2 border-foreground/10 bg-surface p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {getStatusIcon(status.overall)}
        <h3 className="font-display text-sm font-bold text-foreground">
          {getStatusLabel(status.overall)}
        </h3>
      </div>

      <div className="space-y-2">
        <StatusItem label="Moderación" status={status.moderation} />
        <StatusItem label="Embeddings" status={status.embedding} />
        {status.ocr !== 'pending' && <StatusItem label="OCR" status={status.ocr} />}
        {status.vision !== 'pending' && <StatusItem label="Análisis Visual" status={status.vision} />}
      </div>
    </div>
  );
}

function StatusItem({ label, status }: { label: string; status: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-foreground/70">{label}</span>
      <div className="flex items-center gap-1">
        {getStatusIcon(status, 'size-3')}
        <span className="font-medium capitalize text-foreground/90">{getStatusText(status)}</span>
      </div>
    </div>
  );
}

function getStatusIcon(status: string, sizeClass = 'size-4') {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className={`${sizeClass} text-found`} />;
    case 'processing':
      return <Loader2 className={`${sizeClass} animate-spin text-orange`} />;
    case 'failed':
      return <XCircle className={`${sizeClass} text-lost`} />;
    case 'partial':
      return <AlertCircle className={`${sizeClass} text-orange`} />;
    case 'pending':
    default:
      return <Clock className={`${sizeClass} text-foreground/40`} />;
  }
}

function getStatusLabel(status: string): string {
  switch (status) {
    case 'completed':
      return 'Procesamiento completado';
    case 'processing':
      return 'Procesando...';
    case 'failed':
      return 'Error en procesamiento';
    case 'partial':
      return 'Procesamiento parcial';
    case 'pending':
    default:
      return 'En cola';
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case 'completed':
      return 'Listo';
    case 'processing':
      return 'Procesando';
    case 'failed':
      return 'Error';
    case 'pending':
    default:
      return 'Pendiente';
  }
}
