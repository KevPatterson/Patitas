import { useEffect, useState } from 'react';
import { VerifiedBadge } from '../ui/verified-badge';
import { getApprovedVerification, type VerificationKind } from '../../lib/supabase/trust';

type ProfileVerificationBadgeProps = {
  profileId: string;
  size?: 'sm' | 'md';
  showLabel?: boolean;
};

/**
 * Badge que carga la verificación de un perfil concreto.
 *
 * Se usa en fichas de detalle (publicación, perfil), donde solo hay un perfil a
 * la vista. Para listas conviene cargar la verificación en bloque.
 */
export function ProfileVerificationBadge({
  profileId,
  size = 'sm',
  showLabel = true,
}: ProfileVerificationBadgeProps) {
  const [kind, setKind] = useState<VerificationKind | null>(null);

  useEffect(() => {
    let active = true;

    getApprovedVerification(profileId)
      .then((verification) => {
        if (active) setKind(verification?.kind ?? null);
      })
      .catch(() => {
        if (active) setKind(null);
      });

    return () => {
      active = false;
    };
  }, [profileId]);

  if (!kind) return null;

  return <VerifiedBadge kind={kind} size={size} showLabel={showLabel} />;
}
