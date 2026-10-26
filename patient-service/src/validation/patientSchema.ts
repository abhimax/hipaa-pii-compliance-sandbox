import { z } from 'zod';
import { ValidationError } from '../errors/AppError.js';

export const createPatientSchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  ssn: z.string().regex(/^\d{3}-\d{2}-\d{4}$/, 'SSN must be in the format XXX-XX-XXXX'),
  dob: z.iso.date().refine((d) => new Date(d) <= new Date(), 'dob cannot be in the future'),
  diagnosis: z.string().trim().min(1).max(500),
  medical_notes: z.string().trim().max(5000).optional(),
});

export type CreatePatientInput = z.infer<typeof createPatientSchema>;

export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
