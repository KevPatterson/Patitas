import { z } from 'zod';

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

export type VerificationRequestInput = z.infer<typeof verificationRequestSchema>;
