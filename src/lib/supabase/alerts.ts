import { supabase } from './client';
import {
  alertSubscriptionSchema,
  type AlertSubscriptionInput,
} from '../validations/trust';

/**
 * Alertas por municipio.
 *
 * La suscripción vive en `alert_subscriptions` y solo la puede leer y editar su
 * dueño. El fan-out de notificaciones ocurre en la base de datos al insertarse
 * una publicación nueva; el cliente no crea avisos.
 */

export type AlertType = 'LOST' | 'FOUND' | 'SIGHTING';

export type AlertSubscription = {
  profileId: string;
  province: string;
  municipality: string;
  types: AlertType[];
  isActive: boolean;
};

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  LOST: 'Mascotas perdidas',
  FOUND: 'Mascotas encontradas',
  SIGHTING: 'Avistamientos',
};

export const DEFAULT_ALERT_TYPES: AlertType[] = ['LOST', 'FOUND', 'SIGHTING'];

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw new Error('No se pudo comprobar la sesión. Inténtalo de nuevo.');
  }

  if (!data.user) {
    throw new Error('Inicia sesión para configurar tus alertas.');
  }

  return data.user.id;
}

export async function getMyAlertSubscription(): Promise<AlertSubscription | null> {
  const userId = await requireUserId();

  const { data, error } = await supabase
    .from('alert_subscriptions')
    .select('profile_id, province, municipality, types, is_active')
    .eq('profile_id', userId)
    .maybeSingle();

  if (error) {
    throw new Error('No se pudieron cargar tus alertas.');
  }

  if (!data) return null;

  const types = ((data.types ?? []) as AlertType[]).filter((type): type is AlertType =>
    type === 'LOST' || type === 'FOUND' || type === 'SIGHTING'
  );

  return {
    profileId: data.profile_id,
    province: data.province,
    municipality: data.municipality,
    types: types.length > 0 ? types : DEFAULT_ALERT_TYPES,
    isActive: Boolean(data.is_active),
  };
}

export async function saveAlertSubscription(input: AlertSubscriptionInput): Promise<void> {
  const userId = await requireUserId();
  const parsed = alertSubscriptionSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Revisa los datos de la alerta.');
  }

  const { error } = await supabase.from('alert_subscriptions').upsert(
    {
      profile_id: userId,
      province: parsed.data.province,
      municipality: parsed.data.municipality,
      types: parsed.data.types,
      is_active: parsed.data.isActive,
    },
    { onConflict: 'profile_id' }
  );

  if (error) {
    throw new Error('No se pudieron guardar tus alertas. Inténtalo de nuevo.');
  }
}
