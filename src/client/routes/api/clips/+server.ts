import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { generateWebClips } from '../../../../server/clipping/clipService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  parseJsonBody,
  zodErrorDetail,
} from '../../../../server/http/responses.js';
import { CreateClipsRequestSchema } from '../../../../types/index.js';

export const POST: RequestHandler = async (event) => {
  try {
    const input = await parseJsonBody(event, CreateClipsRequestSchema);
    const clips = await generateWebClips(input);
    return jsonOk({ clips });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(400, 'Invalid clip generation request.', zodErrorDetail(error));
    }

    return jsonError(500, 'Failed to generate clips.', errorMessage(error));
  }
};
