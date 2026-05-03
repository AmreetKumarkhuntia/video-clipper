import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { getTranscriptBundle } from '@app/web/lib/services/analysis/transcriptService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';

const TranscriptParamsSchema = z.object({
  videoId: z.string().min(1),
});

export const GET: RequestHandler = async ({ params }) => {
  const parsed = TranscriptParamsSchema.safeParse(params);

  if (!parsed.success) {
    return jsonError(400, 'Invalid transcript request.', zodErrorDetail(parsed.error));
  }

  try {
    const transcript = await getTranscriptBundle(parsed.data.videoId);
    return jsonOk(transcript);
  } catch (error) {
    return jsonError(500, 'Failed to load transcript.', errorMessage(error));
  }
};
