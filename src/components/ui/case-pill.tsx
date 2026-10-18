type CasePillProps = {
  label: string;
  tone: 'lost' | 'found' | 'abandoned' | 'adoption' | 'sighting';
};

const toneClasses: Record<CasePillProps['tone'], string> = {
  lost: 'bg-lost text-white shadow-sm',
  found: 'bg-found text-white shadow-sm',
  abandoned: 'bg-orange text-white shadow-sm',
  adoption: 'bg-purple text-white shadow-sm',
  sighting: 'bg-orange-200 text-[var(--color-orange-900)] shadow-sm',
};

export function CasePill({ label, tone }: CasePillProps) {
  return (
    <span className={`inline-flex items-center rounded-pill px-3.5 py-1.5 text-xs font-bold tracking-wide transition-all duration-base hover:scale-105 ${toneClasses[tone]}`}>
      {label}
    </span>
  );
}
