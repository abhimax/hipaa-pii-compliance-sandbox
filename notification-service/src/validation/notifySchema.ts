import { z } from 'zod';
import { ValidationError } from '../errors/AppError.js';

export const notifySchema = z.object({
  full_name: z.string().trim().min(1).max(200),
  email: z.email().max(254),
  phone_number: z.string().trim().regex(/^\+?[0-9\s\-().]{7,20}$/, 'Invalid phone number'),
  home_address: z.string().trim().min(1).max(500),
  appointment_at: z.iso.datetime({ offset: true }),
  message: z.string().trim().max(320).optional(),
  diagnosis: z.string().trim().max(200).optional(),
  // Test hook to deterministically trigger a mock delivery failure
  simulate_failure: z.boolean().optional(),
});

export type NotifyInput = z.infer<typeof notifySchema>;

export function parseOrThrow<T extends z.ZodType>(schema: T, data: unknown): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
