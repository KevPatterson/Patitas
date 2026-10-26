type StatusTone = 'perdida' | 'encontrada' | 'adopcion' | 'abandonada' | 'avistamiento' | 'activa' | 'resuelta';

type StatusBadgeProps = {
  status: StatusTone | string;
  className?: string;
};

const labels: Record<string, string> = {
  perdida: 'Perdida',
  LOST: 'Perdida',
  encontrada: 'Encontrada',
  FOUND: 'Encontrada',
  adopcion: 'En adopción',
  ADOPTION: 'En adopción',
  abandonada: 'Abandonada',
  ABANDONED: 'Abandonada',
  avistamiento: 'Avistamiento',
  SIGHTING: 'Avistamiento',
  activa: 'Activa',
  ACTIVE: 'Activa',
  resuelta: 'Resuelta',
  RESOLVED: 'Resuelta',
  // Estados internos que el dueño puede ver en su panel.
  HIDDEN: 'Oculta',
  EXPIRED: 'Expirada',
  DELETED: 'Eliminada',
};

const toneByStatus: Record<string, string> = {
  perdida: 'bg-lost text-white shadow-sm',
  LOST: 'bg-lost text-white shadow-sm',
  encontrada: 'bg-found text-white shadow-sm',
  FOUND: 'bg-found text-white shadow-sm',
  adopcion: 'bg-purple text-white shadow-sm',
  ADOPTION: 'bg-purple text-white shadow-sm',
  abandonada: 'bg-orange text-white shadow-sm',
  ABANDONED: 'bg-orange text-white shadow-sm',
  avistamiento: 'bg-orange-200 text-[var(--color-orange-900)] shadow-sm',
  SIGHTING: 'bg-orange-200 text-[var(--color-orange-900)] shadow-sm',
  activa: 'bg-highlight text-foreground border border-orange-200',
  ACTIVE: 'bg-highlight text-foreground border border-orange-200',
  resuelta: 'bg-[var(--color-orange-900)] text-[var(--color-orange-50)] shadow-sm',
  RESOLVED: 'bg-[var(--color-orange-900)] text-[var(--color-orange-50)] shadow-sm',
};

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const label = labels[status] ?? status;
  const tone = toneByStatus[status] ?? 'bg-foreground/10 text-foreground border border-foreground/20';
  return (
    <span
      className={`inline-flex items-center rounded-pill px-3.5 py-1.5 text-xs font-bold tracking-wide transition-all duration-base hover:scale-105 ${tone} ${className}`}
    >
      {label}
    </span>
  );
}

export default StatusBadge;
