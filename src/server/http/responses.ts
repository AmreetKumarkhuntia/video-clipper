import { json } from '@sveltejs/kit';
import { z } from 'zod';
import type { RequestEvent } from '@sveltejs/kit';

export function jsonOk<T>(data: T, init?: ResponseInit): Response {
  return json(data, init);
}

export function jsonError(status: number, message: string, detail?: string): Response {
  return json(
    {
      error: {
        message,
        ...(detail ? { detail } : {}),
      },
    },
    { status },
  );
}

export async function parseJsonBody<T>(event: RequestEvent, schema: z.ZodType<T>): Promise<T> {
  const body: unknown = await event.request.json();
  return schema.parse(body);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function zodErrorDetail(error: z.ZodError): string {
  return error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
}
