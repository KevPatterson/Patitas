import type { ReactNode } from 'react';
import { Logo } from '../Logo';
import { PawPrint } from 'lucide-react';

type AuthCardProps = {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
};

export function AuthCard({ eyebrow, title, description, children, footer }: AuthCardProps) {
  return (
    <div className="relative mx-auto w-full max-w-lg">
      {/* Decoraciones */}
      <div className="blob-decoration absolute -top-10 -right-10 size-32 bg-orange/10" style={{ animationDelay: '1s' }} />
      <div className="blob-decoration absolute -bottom-10 -left-10 size-24 bg-turquoise/10" style={{ animationDelay: '3s' }} />
      
      {/* Card principal */}
      <div className="relative rounded-3xl border-2 border-foreground/10 bg-surface p-6 shadow-lg sm:p-10">
        {/* Logo con huella */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <Logo variant="mark" size={56} className="animate-float" />
          <PawPrint className="size-5 text-orange/40 animate-paw-bounce" />
        </div>
        
        {/* Header */}
        <div className="space-y-2 mb-8">
          <p className="text-center text-xs font-bold uppercase tracking-wider text-foreground/60">{eyebrow}</p>
          <h1 className="text-center font-display text-3xl md:text-4xl font-extrabold text-foreground">
            {title}
          </h1>
          <p className="text-center text-sm leading-relaxed text-foreground/70 max-w-md mx-auto">
            {description}
          </p>
        </div>
        
        {/* Contenido del formulario */}
        <div className="mt-6">{children}</div>
        
        {/* Footer */}
        {footer ? (
          <div className="mt-8 pt-6 border-t-2 border-foreground/10">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
