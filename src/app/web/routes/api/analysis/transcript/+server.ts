import { z } from 'zod';
import type { RequestHandler } from '@sveltejs/kit';
import { analyzeTranscriptForWeb } from '@app/web/lib/services/analysis/analysisService.js';
import {
  errorMessage,
  jsonError,
  jsonOk,
  parseJsonBody,
  zodErrorDetail,
} from '@app/web/lib/services/http/responses.js';
import { CreateAnalysisRequestSchema } from '@app/web/types/analysis.js';

export const POST: RequestHandler = async (event) => {
  try {
    const input = await parseJsonBody(event, CreateAnalysisRequestSchema);
    const plan = await analyzeTranscriptForWeb(input);
    return jsonOk(plan);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return jsonError(400, 'Invalid analysis request.', zodErrorDetail(error));
    }

    return jsonError(500, 'Failed to analyze transcript.', errorMessage(error));
  }
};
