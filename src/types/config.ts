import { z } from 'zod';

const LLM_PROVIDERS = [
  'openai',
  'anthropic',
  'google',
  'xai',
  'mistral',
  'groq',
  'zai',
  'openrouter',
] as const;

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
  openrouter: 'OPENROUTER_API_KEY',
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
    OPENROUTER_API_KEY: z.string().optional(),

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
    CACHE_DIR: z.string().default('outputs/cache'),
    // --- Output dumping ---
    DUMP_OUTPUTS: z.coerce.boolean().default(true),
    // --- LLM evaluation limits ---
    MAX_CHUNKS: z.coerce.number().min(1).optional(),
    LLM_CONCURRENCY: z.coerce.number().min(1).default(3),
    CLIP_CONCURRENCY: z.coerce.number().min(1).default(1),
    // --- Custom system prompt (overrides the default if set) ---
    LLM_SYSTEM_PROMPT: z.string().optional(),
    // --- Gemini model used for audio event detection ---
    AUDIO_GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    // --- Extra instructions appended to the Gemini audio detection prompt ---
    AUDIO_EXTRA_INSTRUCTIONS: z.string().optional(),
    // --- Download mode for yt-dlp ---
    DOWNLOAD_SECTIONS_MODE: z.union([z.literal('all'), z.number().int().positive()]).default('all'),
    // --- FFmpeg paths (optional, for custom ffmpeg/ffprobe locations) ---
    FFMPEG_PATH: z.string().optional(),
    FFPROBE_PATH: z.string().optional(),
    // --- FFmpeg encoding preset for clip generation ---
    FFMPEG_PRESET: z
      .enum(['ultrafast', 'superfast', 'veryfast', 'fast', 'medium', 'slow', 'slower'])
      .default('fast'),
    // --- Timestamp offset for clips (adjusts if transcript is misaligned with video) ---
    TIMESTAMP_OFFSET_SECONDS: z.coerce.number().default(0),
    // --- Audio event detection ---
    AUDIO_DETECTION_ENABLED: z.coerce.boolean().default(true),
    AUDIO_PROVIDER: z.enum(['gemini', 'yamnet', 'both']).default('both'),
    AUDIO_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.3),
    AUDIO_CLIP_PRE_ROLL: z.coerce.number().min(0).default(5),
    AUDIO_CLIP_POST_ROLL: z.coerce.number().min(0).default(15),
    AUDIO_LLM_BOOST_WINDOW: z.coerce.number().min(0).default(10),
    AUDIO_LLM_SCORE_BOOST: z.coerce.number().min(0).default(2),
    // --- Game profile ---
    GAME_PROFILE: z.enum(['valorant', 'fps', 'boss_fight', 'general']).default('general'),
    // --- yt-dlp cookie support (for bot detection / auth) ---
    YT_DLP_COOKIES_FROM_BROWSER: z
      .enum(['chrome', 'firefox', 'safari', 'brave', 'edge', 'opera', 'chromium'])
      .optional(),
    YT_DLP_COOKIES_FILE: z.string().optional(),
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

    // Validate cookie config: only one method allowed at a time
    if (data.YT_DLP_COOKIES_FROM_BROWSER && data.YT_DLP_COOKIES_FILE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['YT_DLP_COOKIES_FROM_BROWSER'],
        message:
          'Cannot set both YT_DLP_COOKIES_FROM_BROWSER and YT_DLP_COOKIES_FILE. Use only one.',
      });
    }
  });

export type Config = z.infer<typeof ConfigSchema>;
