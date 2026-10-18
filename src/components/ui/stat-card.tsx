type StatCardProps = {
  value: string;
  label: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'adoption';
  icon?: React.ReactNode;
};

const toneStyles = {
  default: 'text-[var(--color-orange-900)]',
  success: 'text-found',
  warning: 'text-lost',
  danger: 'text-lost',
  adoption: 'text-purple',
};

const toneBorders = {
  default: 'border-orange-200',
  success: 'border-found/20',
  warning: 'border-lost/20',
  danger: 'border-lost/20',
  adoption: 'border-purple/20',
};

export function StatCard({ value, label, tone = 'default', icon }: StatCardProps) {
  return (
    <article className={`group rounded-2xl border-2 ${toneBorders[tone]} bg-[var(--color-surface-card)] p-5 shadow-md transition-all duration-base ease-smooth hover:shadow-lg hover:-translate-y-1`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className={`font-display text-3xl font-extrabold tracking-tight ${toneStyles[tone]} transition-transform duration-base group-hover:scale-105`}>
            {value}
          </p>
          <p className="mt-2 text-sm font-medium text-[var(--color-text-secondary)]">
            {label}
          </p>
        </div>
        {icon && (
          <div className={`shrink-0 ${toneStyles[tone]} opacity-20 group-hover:opacity-30 transition-opacity`}>
            {icon}
          </div>
        )}
      </div>
    </article>
  );
}
