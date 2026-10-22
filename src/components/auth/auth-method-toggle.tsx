import { Mail, Phone } from 'lucide-react';

export type AuthMethod = 'email' | 'phone';

type AuthMethodToggleProps = {
  value: AuthMethod;
  onChange: (method: AuthMethod) => void;
};

export function AuthMethodToggle({ value, onChange }: AuthMethodToggleProps) {
  return (
    <div
      className="grid grid-cols-2 gap-2 rounded-2xl border-2 border-foreground/10 bg-foreground/5 p-1.5"
      role="group"
      aria-label="Método de acceso"
    >
      <button
        type="button"
        aria-pressed={value === 'email'}
        onClick={() => onChange('email')}
        className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 ${
          value === 'email'
            ? 'bg-surface text-foreground shadow-sm'
            : 'text-foreground/60 hover:text-foreground'
        }`}
      >
        <Mail className="size-4" />
        Correo
      </button>
      <button
        type="button"
        aria-pressed={value === 'phone'}
        onClick={() => onChange('phone')}
        className={`flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 text-sm font-extrabold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange focus-visible:ring-offset-2 ${
          value === 'phone'
            ? 'bg-surface text-foreground shadow-sm'
            : 'text-foreground/60 hover:text-foreground'
        }`}
      >
        <Phone className="size-4" />
        Teléfono
      </button>
    </div>
  );
}
