import type { TextareaHTMLAttributes } from 'react';

type TextareaFieldProps = TextareaHTMLAttributes<HTMLTextAreaElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextareaField({ label, hint, error, id, className = '', ...props }: TextareaFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="block space-y-2 text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }} htmlFor={fieldId}>
      <span className="flex items-center justify-between gap-4">
        <span style={{ fontFamily: 'Figtree, sans-serif' }}>{label}</span>
        {hint ? <span className="text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{hint}</span> : null}
      </span>
      <textarea
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`min-h-32 w-full rounded-2xl border-2 px-4 py-3 text-base shadow-sm outline-none transition ${className}`}
        style={{
          fontFamily: 'Figtree, sans-serif',
          borderColor: 'hsl(var(--border))',
          backgroundColor: 'hsl(var(--input))',
          color: 'hsl(var(--foreground))',
        }}
        {...props}
      />
      {hint && !error ? (
        <span id={`${fieldId}-hint`} className="block text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>
          {hint}
        </span>
      ) : null}
      {error ? (
        <span id={`${fieldId}-error`} className="block text-sm font-medium" style={{ color: 'hsl(var(--destructive))' }}>
          {error}
        </span>
      ) : null}
    </label>
  );
}
