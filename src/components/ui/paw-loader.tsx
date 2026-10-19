type PawLoaderProps = {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const sizeClasses = {
  sm: 'size-6',
  md: 'size-10',
  lg: 'size-16',
};

export function PawLoader({ size = 'md', className = '' }: PawLoaderProps) {
  return (
    <div className={`inline-flex items-center justify-center ${className}`} role="status" aria-label="Cargando">
      <svg
        className={`${sizeClasses[size]} loader-paw text-orange`}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* 4 dedos */}
        <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" fill="currentColor" opacity="0.8" />
        <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" fill="currentColor" opacity="0.9" />
        <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" fill="currentColor" opacity="0.9" />
        <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" fill="currentColor" opacity="0.8" />
        {/* Almohadilla */}
        <path
          d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z"
          fill="currentColor"
        />
      </svg>
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

export function PawTrail({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 ${className}`} role="status" aria-label="Cargando">
      <svg className="size-4 animate-paw-pulse text-orange" style={{ animationDelay: '0ms' }} viewBox="0 0 120 120" fill="none">
        <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" fill="currentColor" opacity="0.8" />
        <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" fill="currentColor" opacity="0.9" />
        <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" fill="currentColor" opacity="0.9" />
        <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" fill="currentColor" opacity="0.8" />
        <path d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z" fill="currentColor" />
      </svg>
      <svg className="size-4 animate-paw-pulse text-orange" style={{ animationDelay: '200ms' }} viewBox="0 0 120 120" fill="none">
        <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" fill="currentColor" opacity="0.8" />
        <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" fill="currentColor" opacity="0.9" />
        <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" fill="currentColor" opacity="0.9" />
        <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" fill="currentColor" opacity="0.8" />
        <path d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z" fill="currentColor" />
      </svg>
      <svg className="size-4 animate-paw-pulse text-orange" style={{ animationDelay: '400ms' }} viewBox="0 0 120 120" fill="none">
        <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" fill="currentColor" opacity="0.8" />
        <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" fill="currentColor" opacity="0.9" />
        <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" fill="currentColor" opacity="0.9" />
        <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" fill="currentColor" opacity="0.8" />
        <path d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z" fill="currentColor" />
      </svg>
      <span className="sr-only">Cargando...</span>
    </div>
  );
}

export function FullPageLoader({ message = 'Cargando...' }: { message?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[hsl(var(--background))]/80 backdrop-blur-sm">
      <div className="flex flex-col items-center gap-4 text-center">
        <PawLoader size="lg" />
        <p className="font-display text-lg font-semibold text-[hsl(var(--foreground))]">{message}</p>
      </div>
    </div>
  );
}
