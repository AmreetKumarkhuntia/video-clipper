import { z } from 'zod';

/**
 * Response helpers. Same `{ error: { message, detail } }` envelope the frontend's
 * `readApiError` already expects, so the client needs no change.
 */

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return Response.json(data as unknown, init);
}

export function jsonError(status: number, message: string, detail?: string): Response {
  return Response.json({ error: { message, ...(detail ? { detail } : {}) } }, { status });
}

/** Takes a Request rather than a framework event, so it is portable. */
export async function parseJsonBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await request.json();
  return schema.parse(body);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function zodErrorDetail(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}
