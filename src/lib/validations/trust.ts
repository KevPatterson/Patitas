import { z } from 'zod';

/** Tipos de caso que pueden disparar una alerta por municipio. */
export const alertTypeSchema = z.enum(['LOST', 'FOUND', 'SIGHTING']);

export const alertSubscriptionSchema = z.object({
  province: z.string().trim().min(2, 'Indica la provincia.').max(80),
  municipality: z.string().trim().min(2, 'Indica el municipio.').max(80),
  types: z
    .array(alertTypeSchema)
    .min(1, 'Elige al menos un tipo de caso.')
    .refine((types) => new Set(types).size === types.length, {
      message: 'No repitas tipos de caso.',
    }),
  isActive: z.boolean(),
});

export const verificationKindSchema = z.enum(['RESCUER', 'SHELTER', 'VET', 'ORG']);

export const verificationRequestSchema = z.object({
  kind: verificationKindSchema,
  evidenceUrl: z
    .string()
    .trim()
    .max(500, 'La URL es demasiado larga.')
    .refine((value) => value === '' || /^https:\/\//.test(value), {
      message: 'La evidencia debe ser un enlace https.',
    }),
  note: z.string().trim().max(500, 'La nota es demasiado larga (máximo 500 caracteres).'),
});

export type AlertSubscriptionInput = z.infer<typeof alertSubscriptionSchema>;
export type VerificationRequestInput = z.infer<typeof verificationRequestSchema>;
