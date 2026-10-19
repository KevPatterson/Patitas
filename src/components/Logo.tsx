type LogoProps = {
  variant?: 'full' | 'mark';
  size?: number;
  className?: string;
  animated?: boolean;
};

export function Logo({ variant = 'full', size = 40, className = '', animated = false }: LogoProps) {
  // Contenedor circular = size, SVG interno = 70% del size
  const containerSize = size;
  const svgSize = Math.round(size * 0.7);
  const textSize = Math.round(size * 0.62);

  return (
    <span
      role="img"
      aria-label="Patitas"
      className={`inline-flex items-center gap-2 ${className} ${animated ? 'group' : ''}`}
      style={{ color: 'currentColor' }}
    >
      {/* Contenedor circular con borde - usa clases CSS para soporte dark mode */}
      <div
        className={`logo-mark flex shrink-0 items-center justify-center rounded-full border-2 ${animated ? 'transition-transform duration-base group-hover:scale-110 group-hover:-rotate-5' : ''}`}
        style={{
          width: containerSize,
          height: containerSize,
          overflow: 'hidden',
        }}
      >
        <svg
          width={svgSize}
          height={svgSize}
          viewBox="0 0 120 120"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          style={{ overflow: 'hidden' }}
        >
          {/* Fondo naranja sólido - usa fill: currentColor desde CSS */}
          <rect width="120" height="120" className="logo-bg" />
          
          {/* 4 dedos - usan currentColor desde CSS */}
          <ellipse cx="24" cy="48" rx="9" ry="12" transform="rotate(-22 24 48)" />
          <ellipse cx="45" cy="28" rx="9" ry="13" transform="rotate(-8 45 28)" />
          <ellipse cx="75" cy="28" rx="9" ry="13" transform="rotate(8 75 28)" />
          <ellipse cx="96" cy="48" rx="9" ry="12" transform="rotate(22 96 48)" />
          
          {/* Almohadilla con hueco transparente (icono ubicación) */}
          <defs>
            <mask id={`paw-mask-logo-${size}-${variant}`}>
              <rect width="120" height="120" fill="white"/>
              <circle cx="60" cy="75" r="8" fill="black"/>
            </mask>
          </defs>
          <path 
            d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z" 
            mask={`url(#paw-mask-logo-${size}-${variant})`} 
          />
        </svg>
      </div>

      {variant === 'full' ? (
        <span
          className="font-display font-extrabold leading-none tracking-[-0.02em]"
          style={{
            fontSize: textSize,
            lineHeight: 1,
            letterSpacing: '-0.02em',
          }}
        >
          patitas
        </span>
      ) : null}
    </span>
  );
}

export default Logo;