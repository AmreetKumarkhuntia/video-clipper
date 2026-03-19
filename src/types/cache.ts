import { z } from 'zod';

export const SegmentRefinementSchema = z.object({
  refined_start: z.number(),
  refined_end: z.number(),
});

export type SegmentRefinement = z.infer<typeof SegmentRefinementSchema>;
