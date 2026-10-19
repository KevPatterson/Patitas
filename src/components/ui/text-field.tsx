import type { InputHTMLAttributes } from 'react';

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
};

export function TextField({ label, hint, error, id, className = '', ...props }: TextFieldProps) {
  const fieldId = id ?? props.name;

  return (
    <label className="block space-y-2 text-sm font-semibold" style={{ color: 'hsl(var(--foreground))' }} htmlFor={fieldId}>
      <span className="flex items-center justify-between gap-4">
        <span style={{ fontFamily: 'Figtree, sans-serif' }}>{label}</span>
        {hint ? <span className="text-xs font-medium" style={{ color: 'hsl(var(--muted-foreground))' }}>{hint}</span> : null}
      </span>
      <input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined}
        className={`h-12 w-full rounded-2xl border-2 px-4 text-base shadow-sm outline-none transition ${className}`}
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
