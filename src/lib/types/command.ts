import { z } from 'zod';

export interface CommandHandler {
  name: string;
  description: string;
  usage: string;
  run: (argv: string[], requestId: string) => Promise<void>;
}

export interface AnalyzeArgs {
  url?: string;
  threshold?: number;
  topN?: number;
  maxChunks?: number;
  maxParallel?: number;
  noCache: boolean;
  noRefine: boolean;
  maxDuration?: number;
  help: boolean;
}

export interface ClipArgs {
  analysisId?: string;
  downloadSections?: 'all' | number;
  localVideo?: string;
  videoPath?: string;
  candidates?: number[];
  help: boolean;
}

export interface CandidatesArgs {
  analysisId?: string;
  json: boolean;
  help: boolean;
}

export interface LibraryArgs {
  mode: 'analyses' | 'clips';
  videoId?: string;
  json: boolean;
  help: boolean;
}

export interface ChannelArgs {
  input?: string;
  pageToken?: string;
  json: boolean;
  help: boolean;
}

export interface ConfigArgs {
  key?: string;
  value?: string;
  reset: boolean;
  help: boolean;
}

export interface AskArgs {
  url?: string;
  question?: string;
  reset: boolean;
  help: boolean;
}

// ── CLI sign-in ──────────────────────────────────────────────────────────────

export interface LoginArgs {
  help: boolean;
}

const CliCredentialOriginSchema = z
  .string()
  .url()
  .refine((value) => new URL(value).origin === value, {
    message: 'Credential keys must be URL origins.',
  });

/** One stored sign-in. `token` is the raw session token; only its hash exists server-side. */
export const CliCredentialSchema = z
  .object({
    token: z.string().min(1),
    /** Informational — the backend is the authority on whether the session still lives. */
    expiresAt: z.number().int().positive().max(8_640_000_000_000_000),
    customerId: z.string().min(1),
    email: z.string().email().optional(),
    role: z.enum(['customer', 'admin']),
  })
  .strict();
export type CliCredential = z.infer<typeof CliCredentialSchema>;

/**
 * Owner-only CLI auth state. Pending revocations hold only the bearer token
 * needed to retire a server session; their record key supplies the backend.
 */
export const CliCredentialsFileSchema = z
  .object({
    version: z.literal(1),
    credentials: z.record(CliCredentialOriginSchema, CliCredentialSchema),
    pendingRevocations: z.record(CliCredentialOriginSchema, z.array(z.string().min(1))).default({}),
  })
  .strict();
export type CliCredentialsFile = z.infer<typeof CliCredentialsFileSchema>;

export type SessionRevoker = (token: string) => Promise<void>;

export interface RevocationRetryResult {
  hadSessions: boolean;
  failures: number;
}
