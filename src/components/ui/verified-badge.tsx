import { BadgeCheck } from 'lucide-react';
import {
  VERIFICATION_KIND_LABELS,
  type VerificationKind,
} from '../../lib/supabase/trust';

type VerifiedBadgeProps = {
  kind: VerificationKind;
  showLabel?: boolean;
  size?: 'sm' | 'md';
  className?: string;
};

/**
 * Badge de perfil verificado.
 *
 * No consulta la base de datos: quien lo pinta ya cargó la verificación. Así se
 * evita una petición por tarjeta en las listas.
 */
export function VerifiedBadge({
  kind,
  showLabel = true,
  size = 'md',
  className = '',
}: VerifiedBadgeProps) {
  const label = VERIFICATION_KIND_LABELS[kind];
  const iconSize = size === 'sm' ? 'size-3.5' : 'size-4';

  return (
    <span
      className={[
        'inline-flex items-center gap-1 rounded-pill bg-turquoise/10 font-bold text-turquoise',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-3 py-1 text-xs',
        className,
      ].join(' ')}
      title={`${label} verificado por Patitas`}
    >
      <BadgeCheck className={iconSize} aria-hidden="true" />
      <span className={showLabel ? '' : 'sr-only'}>
        {showLabel ? label : `${label} verificado`}
      </span>
    </span>
  );
}
