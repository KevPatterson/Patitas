import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './client';

export async function getSession() {
  const { data, error } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return data.session;
}

export async function getUser(): Promise<User | null> {
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    throw error;
  }

  return data.user;
}

export async function signInWithPassword(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signInWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/auth/callback`,
      // Fuerza el selector de cuenta: sin esto Google reutiliza en silencio la
      // última sesión del navegador y el usuario no puede elegir otra cuenta.
      queryParams: { prompt: 'select_account' },
    },
  });
  if (error) throw error;
  return data;
}

export type PhoneChannel = 'sms' | 'whatsapp';

/**
 * Envía un código OTP al teléfono.
 *
 * WhatsApp solo funciona si el proyecto de Supabase usa Twilio o Twilio Verify
 * como proveedor de SMS. En el resto de proveedores hay que usar `sms`.
 */
export async function signInWithPhoneOtp(
  phone: string,
  channel: PhoneChannel,
  options?: { shouldCreateUser?: boolean; fullName?: string; username?: string }
) {
  const metadata: Record<string, string> = {};
  if (options?.fullName) metadata.full_name = options.fullName;
  if (options?.username) metadata.username = options.username;

  const { data, error } = await supabase.auth.signInWithOtp({
    phone,
    options: {
      channel,
      shouldCreateUser: options?.shouldCreateUser ?? true,
      ...(Object.keys(metadata).length > 0 ? { data: metadata } : {}),
    },
  });

  if (error) {
    throw error;
  }

  return data;
}

/** Verifica el código OTP enviado por SMS o WhatsApp. */
export async function verifyPhoneOtp(phone: string, token: string) {
  const { data, error } = await supabase.auth.verifyOtp({
    phone,
    token,
    // Supabase usa `sms` también para los códigos enviados por WhatsApp:
    // el canal solo cambia el transporte del mensaje.
    type: 'sms',
  });

  if (error) {
    throw error;
  }

  return data.session;
}

export async function signUpWithPassword(
  email: string,
  password: string,
  options?: { fullName?: string; username?: string }
) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: options?.fullName,
        username: options?.username,
      },
    },
  });

  if (error) {
    throw error;
  }

  return data.user;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}

export async function resetPassword(email: string) {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/auth/reset-password`,
  });

  if (error) {
    throw error;
  }
}

export async function updatePassword(password: string) {
  const { data, error } = await supabase.auth.updateUser({ password });

  if (error) {
    throw error;
  }

  return data.user;
}

export type AuthSession = Session | null;