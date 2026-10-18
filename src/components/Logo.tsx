type LogoProps = {
  variant?: 'full' | 'mark';
  size?: number;
  className?: string;
  animated?: boolean;
};

export function Logo({ variant = 'full', size = 40, className = '', animated = false }: LogoProps) {
  const markSize = variant === 'full' ? size : size;
  const textSize = Math.round(size * 0.62);
  const maskId = `logo-hole-${size}-${variant}-${Math.random().toString(36).substr(2, 9)}`;

  return (
    <span
      role="img"
      aria-label="Patitas"
      className={`inline-flex items-center gap-2.5 ${className} ${animated ? 'group' : ''}`}
      style={{ color: 'currentColor' }}
    >
      <svg
        width={markSize}
        height={markSize}
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={`shrink-0 ${animated ? 'transition-transform duration-base group-hover:scale-110 group-hover:-rotate-5' : ''}`}
      >
        {/* 4 dedos - naranja #ff8c42 */}
        <ellipse 
          cx="24" 
          cy="48" 
          rx="9" 
          ry="12" 
          transform="rotate(-22 24 48)" 
          fill="#ff8c42"
          className={animated ? 'origin-center transition-transform duration-base group-hover:-translate-y-0.5' : ''}
        />
        <ellipse 
          cx="45" 
          cy="28" 
          rx="9" 
          ry="13" 
          transform="rotate(-8 45 28)" 
          fill="#ff8c42"
          className={animated ? 'origin-center transition-transform duration-base group-hover:-translate-y-0.75' : ''}
          style={{ transitionDelay: animated ? '50ms' : undefined }}
        />
        <ellipse 
          cx="75" 
          cy="28" 
          rx="9" 
          ry="13" 
          transform="rotate(8 75 28)" 
          fill="#ff8c42"
          className={animated ? 'origin-center transition-transform duration-base group-hover:-translate-y-0.75' : ''}
          style={{ transitionDelay: animated ? '100ms' : undefined }}
        />
        <ellipse 
          cx="96" 
          cy="48" 
          rx="9" 
          ry="12" 
          transform="rotate(22 96 48)" 
          fill="#ff8c42"
          className={animated ? 'origin-center transition-transform duration-base group-hover:-translate-y-0.5' : ''}
          style={{ transitionDelay: animated ? '150ms' : undefined }}
        />
        
        {/* Almohadilla con hueco transparente - gradiente naranja */}
        <defs>
          <mask id={maskId}>
            <rect width="120" height="120" fill="white" />
            <circle cx="60" cy="75" r="8" fill="black" />
          </mask>
          <linearGradient id={`${maskId}-gradient`} x1="60" y1="54" x2="60" y2="110" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#ff8c42" />
            <stop offset="100%" stopColor="#f0721f" />
          </linearGradient>
        </defs>
        <path
          d="M60 110 C60 110 33 91 33 74 C33 62 44 54 60 54 C76 54 87 62 87 74 C87 91 60 110 60 110Z"
          fill={`url(#${maskId}-gradient)`}
          mask={`url(#${maskId})`}
        />
      </svg>
      
      {variant === 'full' ? (
        <span
          style={{
            fontFamily: '"Baloo 2", cursive',
            fontWeight: 800,
            fontSize: textSize,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            background: 'linear-gradient(135deg, #3d1d0b 0%, #5a2e16 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          patitas
        </span>
      ) : null}
    </span>
  );
}

export default Logo;
