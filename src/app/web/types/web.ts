import { z } from 'zod';

export const ApiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    detail: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
