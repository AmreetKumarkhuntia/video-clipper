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

/**
 * An error carrying the response to send. `app.onError` returns it as-is, so a
 * handler can refuse from anywhere in its call stack without threading a
 * Response back up by hand — which is what lets a guard `throw` instead of
 * returning a union every caller has to branch on.
 */
export class HttpError extends Error {
  readonly response: Response;

  constructor(response: Response) {
    super(`HTTP ${response.status}`);
    this.name = 'HttpError';
    this.response = response;
  }
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function zodErrorDetail(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}
