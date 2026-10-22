import { z } from 'zod';
import { isValidPhone, normalizePhone } from '../auth/phone';

/**
 * Validaciones de autenticación.
 *
 * Tarea 4.8: se separa la contraseña de acceso de la de registro.
 *   - `loginPassword` solo exige que haya algo: los usuarios que ya existen con
 *     una contraseña antigua y débil deben poder entrar. La política se aplica al
 *     crear o cambiar la contraseña, no al validar el login (bloquear el envío del
 *     formulario por complejidad dejaría fuera de su cuenta a esos usuarios).
 *   - `strongPassword` se exige al registrarse y al restablecer.
 */

/** Contraseña para iniciar sesión: presencia mínima, sin política. */
const loginPassword = z
  .string()
  .min(1, 'Ingresa tu contraseña.')
  .max(72, 'La contraseña es demasiado larga.');

/**
 * Contraseña nueva: 8-72 caracteres, al menos una letra y un número.
 *
 * El máximo de 72 no es arbitrario: bcrypt (lo que usa Supabase por defecto)
 * ignora todo lo que pase de 72 bytes, así que aceptar más daría una falsa
 * sensación de seguridad.
 */
const strongPassword = z
  .string()
  .min(8, 'La contraseña debe tener al menos 8 caracteres.')
  .max(72, 'La contraseña no puede superar los 72 caracteres.')
  .regex(/[A-Za-z]/, 'La contraseña debe incluir al menos una letra.')
  .regex(/\d/, 'La contraseña debe incluir al menos un número.');

const fullNameSchema = z.string().min(2, 'Ingresa tu nombre o apellido.');

const usernameSchema = z
  .string()
  .min(3, 'El usuario debe tener al menos 3 caracteres.')
  .regex(/^[a-z0-9._-]+$/i, 'Solo usa letras, números, puntos, guiones o guiones bajos.');

const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Ingresa tu teléfono.')
  .refine((value) => isValidPhone(normalizePhone(value)), {
    message: 'Ingresa un teléfono válido con código de país.',
  });

export const loginSchema = z.object({
  email: z.string().email('Ingresa un correo válido.'),
  password: loginPassword,
});

export const registerSchema = z.object({
  fullName: fullNameSchema,
  username: usernameSchema,
  email: z.string().email('Ingresa un correo válido.'),
  password: strongPassword,
});

/**
 * Esquema del acceso por teléfono.
 *
 * En el registro se piden nombre y usuario porque el perfil se crea en el mismo
 * momento en que Supabase da de alta al usuario. En el login esos campos no
 * aplican: la cuenta puede existir ya.
 */
export function createPhoneAuthSchema(mode: 'login' | 'register') {
  return z.object({
    phone: phoneSchema,
    fullName: mode === 'register' ? fullNameSchema : z.string().optional(),
    username: mode === 'register' ? usernameSchema : z.string().optional(),
  });
}

export const phoneOtpSchema = z.object({
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Ingresa el código de 6 dígitos.'),
});

export const resetPasswordSchema = z.object({
  email: z.string().email('Ingresa un correo válido.'),
});

export const newPasswordSchema = z
  .object({
    password: strongPassword,
    confirmPassword: z.string().min(8, 'Confirma la nueva contraseña.'),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: 'Las contraseñas no coinciden.',
    path: ['confirmPassword'],
  });

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type PhoneAuthInput = z.infer<ReturnType<typeof createPhoneAuthSchema>>;
export type PhoneOtpInput = z.infer<typeof phoneOtpSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
