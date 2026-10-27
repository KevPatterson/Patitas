import { supabase } from './client';
import { verificationRequestSchema } from '../validations/trust';

/**
 * Verificación de perfiles y reputación por reencuentros confirmados.
 *
 * La lectura pública de `profile_verifications` está limitada por privilegios de
 * columna: el cliente solo puede pedir id, profile_id, kind, status, created_at
 * y reviewed_at. La evidencia queda solo para la API de administración.
 */

export type VerificationKind = 'RESCUER' | 'SHELTER' | 'VET' | 'ORG';
export type VerificationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export type ProfileVerification = {
  id: string;
  profile_id: string;
  kind: VerificationKind;
  status: VerificationStatus;
  created_at: string;
  reviewed_at: string | null;
};

export type ProfileReputation = {
  reunionsConfirmed: number;
  rescuesConfirmed: number;
};

export type PublicationReunionStatus = {
  ownerConfirmed: boolean;
  finderConfirmed: boolean;
  myRole: 'OWNER' | 'FINDER' | null;
  totalConfirmations: number;
};

export const VERIFICATION_KIND_LABELS: Record<VerificationKind, string> = {
  RESCUER: 'Rescatista',
  SHELTER: 'Refugio o albergue',
  VET: 'Veterinaria',
  ORG: 'Organización protectora',
};

export const VERIFICATION_STATUS_LABELS: Record<VerificationStatus, string> = {
  PENDING: 'En revisión',
  APPROVED: 'Verificado',
  REJECTED: 'No aprobada',
};

/** Columnas públicas de una verificación. */
const VERIFICATION_COLUMNS = 'id, profile_id, kind, status, created_at, reviewed_at';

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error('No se pudo comprobar la sesión. Inténtalo de nuevo.');
  }

  if (!data.user) {
    throw new Error('Inicia sesión para gestionar tu verificación.');
  }

  return data.user.id;
}

/** Verificación aprobada de un perfil, para pintar el badge. */
export async function getApprovedVerification(
  profileId: string
): Promise<ProfileVerification | null> {
  const { data, error } = await supabase
    .from('profile_verifications')
    .select(VERIFICATION_COLUMNS)
    .eq('profile_id', profileId)
    .eq('status', 'APPROVED')
    .maybeSingle();

  if (error) {
    throw new Error('No se pudo cargar la verificación del perfil.');
  }

  return (data as ProfileVerification | null) ?? null;
}

/**
 * Solicitud propia más reciente, en cualquier estado.
 *
 * Un perfil puede acumular una fila rechazada y otra pendiente (el índice único
 * solo cubre PENDING/APPROVED), así que se ordena por fecha y se toma una. Con
 * `maybeSingle()` sin límite, Supabase fallaría al recibir más de una fila.
 */
export async function getMyVerification(): Promise<ProfileVerification | null> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('profile_verifications')
    .select(VERIFICATION_COLUMNS)
    .eq('profile_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error('No se pudo cargar tu solicitud de verificación.');
  }

  return (data as ProfileVerification | null) ?? null;
}

export type RequestVerificationInput = {
  kind: VerificationKind;
  evidenceUrl?: string;
  note?: string;
};

/** Crea una solicitud PENDING. El índice único impide duplicados activos. */
export async function requestVerification(input: RequestVerificationInput): Promise<void> {
  const userId = await requireUserId();
  const parsed = verificationRequestSchema.safeParse({
    kind: input.kind,
    evidenceUrl: input.evidenceUrl ?? '',
    note: input.note ?? '',
  });

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Revisa los datos de la solicitud.');
  }

  const evidenceUrl = parsed.data.evidenceUrl.trim();
  const note = parsed.data.note.trim();

  const { error } = await supabase.from('profile_verifications').insert({
    profile_id: userId,
    kind: parsed.data.kind,
    evidence_url: evidenceUrl || null,
    note: note || null,
  });

  if (error) {
    if (error.code === '23505') {
      throw new Error('Ya tienes una solicitud en revisión o aprobada.');
    }

    throw new Error('No se pudo enviar la solicitud. Inténtalo de nuevo.');
  }
}

/** Cancela una solicitud que todavía está pendiente. */
export async function cancelVerification(id: string): Promise<void> {
  const userId = await requireUserId();

  const { error } = await supabase
    .from('profile_verifications')
    .delete()
    .eq('id', id)
    .eq('profile_id', userId)
    .eq('status', 'PENDING');

  if (error) {
    throw new Error('No se pudo cancelar la solicitud.');
  }
}

/** Reencuentros confirmados como dueño y como quien encontró a la mascota. */
export async function getProfileReputation(profileId: string): Promise<ProfileReputation> {
  const { data, error } = await supabase
    .rpc('get_profile_reputation', { p_profile_id: profileId })
    .maybeSingle();

  if (error) {
    throw new Error('No se pudo cargar la reputación del perfil.');
  }

  const row = (data ?? {}) as {
    reunions_confirmed?: number | null;
    rescues_confirmed?: number | null;
  };

  return {
    reunionsConfirmed: row.reunions_confirmed ?? 0,
    rescuesConfirmed: row.rescues_confirmed ?? 0,
  };
}

/** Estado de confirmación de un reencuentro concreto. */
export async function getPublicationReunionStatus(
  publicationId: string
): Promise<PublicationReunionStatus> {
  const { data, error } = await supabase
    .rpc('get_publication_reunion_status', { p_publication_id: publicationId })
    .maybeSingle();

  if (error) {
    throw new Error('No se pudo cargar el estado del reencuentro.');
  }

  const row = (data ?? {}) as {
    owner_confirmed?: boolean | null;
    finder_confirmed?: boolean | null;
    my_role?: string | null;
    total_confirmations?: number | null;
  };

  const myRole = row.my_role === 'OWNER' || row.my_role === 'FINDER' ? row.my_role : null;

  return {
    ownerConfirmed: Boolean(row.owner_confirmed),
    finderConfirmed: Boolean(row.finder_confirmed),
    myRole,
    totalConfirmations: row.total_confirmations ?? 0,
  };
}

/** Confirma el reencuentro. Devuelve el papel con el que quedó registrado. */
export async function confirmReunion(publicationId: string): Promise<'OWNER' | 'FINDER'> {
  const { data, error } = await supabase.rpc('confirm_reunion', {
    p_publication_id: publicationId,
  });

  if (error) {
    throw new Error(error.hint || error.message || 'No se pudo confirmar el reencuentro.');
  }

  return data === 'OWNER' ? 'OWNER' : 'FINDER';
}
