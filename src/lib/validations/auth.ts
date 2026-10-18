import { z } from 'zod';

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

export const loginSchema = z.object({
  email: z.string().email('Ingresa un correo válido.'),
  password: loginPassword,
});

export const registerSchema = z.object({
  fullName: z.string().min(2, 'Ingresa tu nombre o apellido.'),
  username: z
    .string()
    .min(3, 'El usuario debe tener al menos 3 caracteres.')
    .regex(/^[a-z0-9._-]+$/i, 'Solo usa letras, números, puntos, guiones o guiones bajos.'),
  email: z.string().email('Ingresa un correo válido.'),
  password: strongPassword,
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
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type NewPasswordInput = z.infer<typeof newPasswordSchema>;
