import { z } from 'zod';

export const QaCitationSchema = z.object({
  label: z.string(), // e.g. "[1:23]"
  timeSec: z.number().nonnegative(),
});
export type QaCitation = z.infer<typeof QaCitationSchema>;

export const QaRoleSchema = z.enum(['user', 'assistant']);
export type QaRole = z.infer<typeof QaRoleSchema>;

export const QaMessageSchema = z.object({
  id: z.string(),
  role: QaRoleSchema,
  content: z.string(),
  citations: z.array(QaCitationSchema),
  createdAt: z.string(), // ISO timestamp
});
export type QaMessage = z.infer<typeof QaMessageSchema>;

export const QaRequestSchema = z.object({
  videoId: z.string().min(1),
  question: z.string().min(1),
  history: z.array(QaMessageSchema).default([]),
  title: z.string().optional(),
  channelTitle: z.string().optional(),
  description: z.string().optional(),
});
export type QaRequest = z.infer<typeof QaRequestSchema>;

export const QaAnswerSchema = z.object({
  messageId: z.string(),
  content: z.string(),
  citations: z.array(QaCitationSchema),
});
export type QaAnswer = z.infer<typeof QaAnswerSchema>;

export type QaTextSegment =
  | { type: 'text'; value: string }
  | { type: 'cite'; label: string; timeSec: number };

export interface QaStreamCallbacks {
  onStarted?: () => void;
  onProgress?: (text: string) => void;
  onComplete?: (answer: QaAnswer) => void;
  onError?: (message: string) => void;
}
