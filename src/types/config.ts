import { z } from 'zod';

const LLM_PROVIDERS = ['openai', 'anthropic', 'google', 'xai', 'mistral', 'groq', 'zai'] as const;

export type LLMProvider = (typeof LLM_PROVIDERS)[number];

/** Map each provider to the env var name that holds its API key. */
const PROVIDER_KEY_MAP: Record<LLMProvider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  xai: 'XAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
  zai: 'ZAI_API_KEY',
};

export const ConfigSchema = z
  .object({
    // --- Provider selection ---
    LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('openai'),

    // --- Per-provider API keys (all optional at schema level; enforced via superRefine) ---
    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    XAI_API_KEY: z.string().optional(),
    MISTRAL_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    ZAI_API_KEY: z.string().optional(),

    // --- Tunable parameters ---
    SCORE_THRESHOLD: z.coerce.number().min(1).max(10).default(7),
    TOP_N_SEGMENTS: z.coerce.number().min(1).default(10),
    CHUNK_LENGTH_SEC: z.coerce.number().min(10).default(120),
    CHUNK_OVERLAP_SEC: z.coerce.number().min(0).default(20),
    MICRO_BLOCK_SEC: z.coerce.number().min(5).default(15),
    LLM_MODEL: z.string().default('gpt-4o'),
    LLM_MAX_RETRIES: z.coerce.number().min(0).default(3),
    DOWNLOAD_DIR: z.string().default('downloads/'),
    OUTPUT_DIR: z.string().default('outputs/'),
  })
  .superRefine((data, ctx) => {
    const provider = data.LLM_PROVIDER;
    const keyName = PROVIDER_KEY_MAP[provider];
    const keyValue = data[keyName as keyof typeof data] as string | undefined;

    if (!keyValue || keyValue.trim() === '') {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [keyName],
        message: `${keyName} is required when LLM_PROVIDER is "${provider}"`,
      });
    }
  });

export type Config = z.infer<typeof ConfigSchema>;
