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
  'custom',
] as const;

type LLMProvider = (typeof LLM_PROVIDERS)[number];

const PROVIDER_KEY_MAP: Record<LLMProvider, string> = {
  openai: 'OPENAI_API_KEY',
  anthropic: 'ANTHROPIC_API_KEY',
  google: 'GOOGLE_GENERATIVE_AI_API_KEY',
  xai: 'XAI_API_KEY',
  mistral: 'MISTRAL_API_KEY',
  groq: 'GROQ_API_KEY',
  zai: 'ZAI_API_KEY',
  openrouter: 'OPENROUTER_API_KEY',
  custom: 'CUSTOM_OPENAI_API_KEY',
};

export const ConfigSchema = z
  .object({
    LLM_PROVIDER: z.enum(LLM_PROVIDERS).default('openai'),

    OPENAI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    GOOGLE_GENERATIVE_AI_API_KEY: z.string().optional(),
    XAI_API_KEY: z.string().optional(),
    MISTRAL_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    ZAI_API_KEY: z.string().optional(),
    OPENROUTER_API_KEY: z.string().optional(),
    CUSTOM_OPENAI_API_KEY: z.string().optional(),
    CUSTOM_OPENAI_BASE_URL: z.string().url().optional(),
    YOUTUBE_API_KEY: z.string().optional(),
    YOUTUBE_OAUTH_CLIENT_ID: z.string().optional(),
    YOUTUBE_OAUTH_CLIENT_SECRET: z.string().optional(),
    YOUTUBE_OAUTH_REDIRECT_URI: z.string().url().optional(),

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
    DUMP_OUTPUTS: z.coerce.boolean().default(true),
    MAX_CHUNKS: z.coerce.number().min(1).optional(),
    LLM_CONCURRENCY: z.coerce.number().min(1).default(3),
    CLIP_CONCURRENCY: z.coerce.number().min(1).default(1),
    LLM_SYSTEM_PROMPT: z.string().optional(),
    PUBLISH_METADATA_SYSTEM_PROMPT: z.string().optional(),
    SUBTITLE_PLAN_SYSTEM_PROMPT: z.string().optional(),
    AUDIO_GEMINI_MODEL: z.string().default('gemini-2.5-flash'),
    AUDIO_EXTRA_INSTRUCTIONS: z.string().optional(),
    DOWNLOAD_SECTIONS_MODE: z.union([z.literal('all'), z.number().int().positive()]).default('all'),
    PARTIAL_DOWNLOAD_ENABLED: z.coerce.boolean().default(false),
    FFMPEG_PATH: z.string().optional(),
    FFPROBE_PATH: z.string().optional(),
    FFMPEG_PRESET: z
      .enum(['ultrafast', 'superfast', 'veryfast', 'fast', 'medium', 'slow', 'slower'])
      .default('fast'),
    TIMESTAMP_OFFSET_SECONDS: z.coerce.number().default(0),
    TRANSCRIPT_PROVIDER: z
      .string()
      .default('ytdlp')
      .refine(
        (v) => {
          const parts = v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          return parts.length > 0 && parts.every((p) => ['ytdlp', 'whisper', 'gemini'].includes(p));
        },
        {
          message:
            'TRANSCRIPT_PROVIDER must be a comma-separated list of: ytdlp, whisper, gemini (e.g. "ytdlp")',
        },
      ),
    AUDIO_DETECTION_ENABLED: z.coerce.boolean().default(true),
    AUDIO_PROVIDER: z
      .string()
      .default('gemini,whisper')
      .refine(
        (v) => {
          const legacy = v.trim() === 'both';
          if (legacy) return true;
          const parts = v
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
          return (
            parts.length > 0 && parts.every((p) => ['gemini', 'whisper', 'yamnet'].includes(p))
          );
        },
        {
          message:
            'AUDIO_PROVIDER must be a comma-separated list of: gemini, whisper, yamnet (e.g. "gemini,whisper")',
        },
      ),
    AUDIO_WHISPER_MODEL: z.enum(['tiny', 'base', 'small', 'medium', 'large-v3']).default('medium'),
    AUDIO_CONFIDENCE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.3),
    AUDIO_CLIP_PRE_ROLL: z.coerce.number().min(0).default(5),
    AUDIO_CLIP_POST_ROLL: z.coerce.number().min(0).default(15),
    AUDIO_LLM_BOOST_WINDOW: z.coerce.number().min(0).default(10),
    AUDIO_LLM_SCORE_BOOST: z.coerce.number().min(0).default(2),
    GAME_PROFILE: z.enum(['valorant', 'fps', 'boss_fight', 'general']).default('general'),
    YT_DLP_COOKIES_FROM_BROWSER: z.string().optional(),
    YT_DLP_COOKIES_FILE: z.string().optional(),
    YT_DLP_QUIET: z.coerce.boolean().default(false),
    YT_DLP_RETRY_COUNT: z.coerce.number().int().min(0).max(5).default(0),
    YT_DLP_SEGMENT_COOKIES_ENABLED: z.coerce.boolean().default(false),
    YT_DLP_PLAYER_CLIENT: z
      .enum(['auto', 'android_vr', 'mweb', 'web', 'android', 'ios'])
      .default('auto'),
    YT_DLP_NO_CHECK_CERTIFICATES: z.coerce.boolean().default(false),
    YT_DLP_FORCE_IPV4: z.coerce.boolean().default(false),
    YT_DLP_GEO_BYPASS: z.coerce.boolean().default(false),
    YT_DLP_SLEEP_REQUESTS: z.coerce.number().int().min(0).max(30).default(0),

    // ---- Cache backend -------------------------------------------------------
    CACHE_BACKEND: z.enum(['file', 'mongodb']).default('file'),
    MONGODB_URI: z.string().optional(),
    MONGODB_DATABASE: z.string().default('video-clipper-cache'),
    CACHE_TTL_SECONDS: z.coerce.number().min(0).default(0),

    // ---- YouTube publish defaults --------------------------------------------
    YT_DEFAULT_CATEGORY_ID: z.string().default('22'),
    YT_DEFAULT_PRIVACY: z.enum(['private', 'unlisted', 'public']).default('private'),
    YT_DEFAULT_LICENSE: z.enum(['youtube', 'creativeCommon']).default('youtube'),
    YT_DEFAULT_MADE_FOR_KIDS: z.coerce.boolean().default(false),
    YT_DEFAULT_EMBEDDABLE: z.coerce.boolean().default(true),
    YT_DEFAULT_PUBLIC_STATS_VIEWABLE: z.coerce.boolean().default(true),
    YT_DEFAULT_CONTAINS_SYNTHETIC_MEDIA: z.coerce.boolean().default(false),
    YT_DEFAULT_IS_SHORT: z.coerce.boolean().default(false),
    YT_SCHEDULE_ENABLED: z.coerce.boolean().default(true),
    YT_SCHEDULE_INTERVAL_MIN: z.coerce.number().min(1).default(45),

    // ---- Logging -------------------------------------------------------------
    LOG_COLOR: z.coerce.boolean().default(true),
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

    if (
      provider === 'custom' &&
      (!data.CUSTOM_OPENAI_BASE_URL || data.CUSTOM_OPENAI_BASE_URL.trim() === '')
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['CUSTOM_OPENAI_BASE_URL'],
        message: 'CUSTOM_OPENAI_BASE_URL is required when LLM_PROVIDER is "custom"',
      });
    }

    if (data.YT_DLP_COOKIES_FROM_BROWSER && data.YT_DLP_COOKIES_FILE) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['YT_DLP_COOKIES_FROM_BROWSER'],
        message:
          'Cannot set both YT_DLP_COOKIES_FROM_BROWSER and YT_DLP_COOKIES_FILE. Use only one.',
      });
    }

    if (data.CACHE_BACKEND === 'mongodb' && (!data.MONGODB_URI || data.MONGODB_URI.trim() === '')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['MONGODB_URI'],
        message: 'MONGODB_URI is required when CACHE_BACKEND is "mongodb"',
      });
    }
  });

export type Config = z.infer<typeof ConfigSchema>;

export const CONFIG_GROUPS = [
  {
    id: 'llm',
    label: 'LLM',
    fields: [
      'LLM_PROVIDER',
      'LLM_MODEL',
      'LLM_MAX_RETRIES',
      'LLM_CONCURRENCY',
      'LLM_SYSTEM_PROMPT',
      'PUBLISH_METADATA_SYSTEM_PROMPT',
      'SUBTITLE_PLAN_SYSTEM_PROMPT',
    ],
  },
  {
    id: 'api-keys',
    label: 'API Keys',
    fields: [
      'OPENAI_API_KEY',
      'ANTHROPIC_API_KEY',
      'GOOGLE_GENERATIVE_AI_API_KEY',
      'XAI_API_KEY',
      'MISTRAL_API_KEY',
      'GROQ_API_KEY',
      'ZAI_API_KEY',
      'OPENROUTER_API_KEY',
      'CUSTOM_OPENAI_API_KEY',
      'CUSTOM_OPENAI_BASE_URL',
    ],
  },
  {
    id: 'youtube',
    label: 'YouTube',
    fields: [
      'YOUTUBE_API_KEY',
      'YOUTUBE_OAUTH_CLIENT_ID',
      'YOUTUBE_OAUTH_CLIENT_SECRET',
      'YOUTUBE_OAUTH_REDIRECT_URI',
      'YT_DLP_COOKIES_FROM_BROWSER',
      'YT_DLP_COOKIES_FILE',
      'YT_DLP_QUIET',
      'YT_DLP_RETRY_COUNT',
      'YT_DLP_SEGMENT_COOKIES_ENABLED',
      'YT_DLP_PLAYER_CLIENT',
      'YT_DLP_NO_CHECK_CERTIFICATES',
      'YT_DLP_FORCE_IPV4',
      'YT_DLP_GEO_BYPASS',
      'YT_DLP_SLEEP_REQUESTS',
      'YT_DEFAULT_CATEGORY_ID',
      'YT_DEFAULT_PRIVACY',
      'YT_DEFAULT_LICENSE',
      'YT_DEFAULT_MADE_FOR_KIDS',
      'YT_DEFAULT_EMBEDDABLE',
      'YT_DEFAULT_PUBLIC_STATS_VIEWABLE',
      'YT_DEFAULT_CONTAINS_SYNTHETIC_MEDIA',
      'YT_DEFAULT_IS_SHORT',
      'YT_SCHEDULE_ENABLED',
      'YT_SCHEDULE_INTERVAL_MIN',
    ],
  },
  {
    id: 'chunking',
    label: 'Chunking',
    fields: ['CHUNK_LENGTH_SEC', 'CHUNK_OVERLAP_SEC', 'MICRO_BLOCK_SEC', 'MAX_CHUNKS'],
  },
  { id: 'selection', label: 'Segment Selection', fields: ['SCORE_THRESHOLD', 'TOP_N_SEGMENTS'] },
  { id: 'transcript', label: 'Transcript', fields: ['TRANSCRIPT_PROVIDER'] },
  {
    id: 'audio',
    label: 'Audio Detection',
    fields: [
      'AUDIO_DETECTION_ENABLED',
      'AUDIO_PROVIDER',
      'AUDIO_GEMINI_MODEL',
      'AUDIO_EXTRA_INSTRUCTIONS',
      'AUDIO_WHISPER_MODEL',
      'AUDIO_CONFIDENCE_THRESHOLD',
      'AUDIO_CLIP_PRE_ROLL',
      'AUDIO_CLIP_POST_ROLL',
      'AUDIO_LLM_BOOST_WINDOW',
      'AUDIO_LLM_SCORE_BOOST',
      'GAME_PROFILE',
    ],
  },
  {
    id: 'ffmpeg',
    label: 'FFmpeg & Download',
    fields: [
      'DOWNLOAD_SECTIONS_MODE',
      'PARTIAL_DOWNLOAD_ENABLED',
      'FFMPEG_PATH',
      'FFPROBE_PATH',
      'FFMPEG_PRESET',
      'TIMESTAMP_OFFSET_SECONDS',
    ],
  },
  {
    id: 'output',
    label: 'Output',
    fields: [
      'DOWNLOAD_DIR',
      'OUTPUT_DIR',
      'CACHE_DIR',
      'DUMP_OUTPUTS',
      'CLIP_CONCURRENCY',
      'LOG_COLOR',
    ],
  },
  {
    id: 'cache',
    label: 'Cache',
    fields: ['CACHE_BACKEND', 'MONGODB_URI', 'MONGODB_DATABASE', 'CACHE_TTL_SECONDS'],
  },
] as const;

export type ConfigWidget = 'text' | 'textarea' | 'number' | 'toggle' | 'select' | 'slider';

export interface ConfigFieldMeta {
  description: string;
  widget: ConfigWidget;
  secret?: boolean;
  placeholder?: string;
}

export interface ModelFactoryApiKeys {
  OPENAI_API_KEY?: string;
  GOOGLE_GENERATIVE_AI_API_KEY?: string;
  ZAI_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  CUSTOM_OPENAI_BASE_URL?: string;
  CUSTOM_OPENAI_API_KEY?: string;
}

export interface SetConfigResult {
  success: boolean;
  warnings: string[];
}

export interface ConfigFieldDescriptor {
  key: string;
  label: string;
  description: string;
  widget: ConfigWidget;
  required: boolean;
  secret: boolean;
  defaultValue: unknown;
  min?: number;
  max?: number;
  options?: string[];
  optionLabels?: string[];
  placeholder?: string;
}

export interface ConfigGroupDescriptor {
  id: string;
  label: string;
  fields: ConfigFieldDescriptor[];
}

export interface ConfigRegistryResponse {
  groups: ConfigGroupDescriptor[];
}

export const CONFIG_FIELD_META: Record<string, ConfigFieldMeta> = {
  LLM_PROVIDER: { description: 'Which LLM provider to use', widget: 'select' },
  LLM_MODEL: {
    description: 'Model ID passed to the provider',
    widget: 'text',
    placeholder: 'gpt-4o',
  },
  LLM_MAX_RETRIES: { description: 'Retry count for rate-limited LLM calls', widget: 'number' },
  LLM_CONCURRENCY: { description: 'Max parallel LLM calls', widget: 'number' },
  LLM_SYSTEM_PROMPT: {
    description: 'Override the transcript analysis system prompt (leave blank to use the default)',
    widget: 'textarea',
  },
  PUBLISH_METADATA_SYSTEM_PROMPT: {
    description:
      'Override the YouTube title/description/tags generation prompt (leave blank to use the default)',
    widget: 'textarea',
  },
  SUBTITLE_PLAN_SYSTEM_PROMPT: {
    description:
      'Override the subtitle planning/correction prompt (leave blank to use the default)',
    widget: 'textarea',
  },
  OPENAI_API_KEY: { description: 'OpenAI API key', widget: 'text', secret: true },
  ANTHROPIC_API_KEY: { description: 'Anthropic API key', widget: 'text', secret: true },
  GOOGLE_GENERATIVE_AI_API_KEY: {
    description: 'Google Generative AI API key',
    widget: 'text',
    secret: true,
  },
  XAI_API_KEY: { description: 'xAI API key', widget: 'text', secret: true },
  MISTRAL_API_KEY: { description: 'Mistral API key', widget: 'text', secret: true },
  GROQ_API_KEY: { description: 'Groq API key', widget: 'text', secret: true },
  ZAI_API_KEY: { description: 'Zai API key', widget: 'text', secret: true },
  OPENROUTER_API_KEY: { description: 'OpenRouter API key', widget: 'text', secret: true },
  CUSTOM_OPENAI_API_KEY: {
    description: 'Custom OpenAI-compatible API key',
    widget: 'text',
    secret: true,
  },
  CUSTOM_OPENAI_BASE_URL: { description: 'Custom OpenAI-compatible base URL', widget: 'text' },
  YOUTUBE_API_KEY: { description: 'YouTube Data API v3 key', widget: 'text', secret: true },
  YOUTUBE_OAUTH_CLIENT_ID: {
    description: 'Google OAuth client ID for YouTube uploads',
    widget: 'text',
    secret: true,
  },
  YOUTUBE_OAUTH_CLIENT_SECRET: {
    description: 'Google OAuth client secret for YouTube uploads',
    widget: 'text',
    secret: true,
  },
  YOUTUBE_OAUTH_REDIRECT_URI: {
    description: 'Google OAuth redirect URI for YouTube uploads',
    widget: 'text',
    placeholder: 'http://localhost:5002/api/youtube/auth/callback',
  },
  YT_DLP_COOKIES_FROM_BROWSER: {
    description: 'Browser profile for cookies (e.g. chrome:Profile 1)',
    widget: 'text',
  },
  YT_DLP_COOKIES_FILE: { description: 'Path to cookies.txt file', widget: 'text' },
  YT_DLP_QUIET: {
    description:
      'Suppress yt-dlp stderr/stdout output in terminal (errors still caught and reported)',
    widget: 'toggle',
  },
  YT_DLP_RETRY_COUNT: {
    description: 'Retry failed yt-dlp calls with exponential backoff — 2s, 4s, 8s… (0 = no retry)',
    widget: 'number',
  },
  YT_DLP_SEGMENT_COOKIES_ENABLED: {
    description:
      'Pass cookies during per-segment (partial) downloads. Enable for private or bot-gated videos. Note: disables the ANDROID_VR client bypass — may fail on some public videos.',
    widget: 'toggle',
  },
  YT_DLP_PLAYER_CLIENT: {
    description:
      'Force a specific yt-dlp player client. "Auto" lets yt-dlp decide. "Android VR" bypasses bot-detection for public videos without cookies.',
    widget: 'select',
  },
  YT_DLP_NO_CHECK_CERTIFICATES: {
    description:
      'Skip SSL certificate verification (--no-check-certificates). Try this if downloads fail due to certificate errors.',
    widget: 'toggle',
  },
  YT_DLP_FORCE_IPV4: {
    description:
      'Force all yt-dlp connections to use IPv4 (--force-ipv4). Helps on networks where IPv6 is unreliable.',
    widget: 'toggle',
  },
  YT_DLP_GEO_BYPASS: {
    description: 'Attempt to bypass geographic content restrictions (--geo-bypass).',
    widget: 'toggle',
  },
  YT_DLP_SLEEP_REQUESTS: {
    description:
      'Seconds to sleep between yt-dlp requests (0 = no sleep). Increase to avoid rate-limiting on large batches.',
    widget: 'number',
  },
  SCORE_THRESHOLD: { description: 'Min score (1-10) for a segment to be kept', widget: 'slider' },
  TOP_N_SEGMENTS: { description: 'Max segments returned', widget: 'number' },
  CHUNK_LENGTH_SEC: { description: 'LLM chunk window size in seconds', widget: 'number' },
  CHUNK_OVERLAP_SEC: { description: 'Overlap between consecutive chunks', widget: 'number' },
  MICRO_BLOCK_SEC: { description: 'Micro-block grouping window in seconds', widget: 'number' },
  MAX_CHUNKS: {
    description: 'Cap on LLM chunks for cost control (empty = unlimited)',
    widget: 'number',
  },
  TRANSCRIPT_PROVIDER: {
    description: 'Ordered fallback chain (comma-separated): ytdlp, whisper, gemini',
    widget: 'text',
  },
  AUDIO_DETECTION_ENABLED: {
    description: 'Enable/disable audio event detection',
    widget: 'toggle',
  },
  AUDIO_PROVIDER: {
    description: 'Audio analysis providers (comma-separated): gemini, whisper, yamnet',
    widget: 'text',
  },
  AUDIO_GEMINI_MODEL: { description: 'Gemini model for audio detection', widget: 'text' },
  AUDIO_EXTRA_INSTRUCTIONS: {
    description: 'Extra instructions for Gemini audio prompt',
    widget: 'text',
  },
  AUDIO_WHISPER_MODEL: { description: 'Whisper model size', widget: 'select' },
  AUDIO_CONFIDENCE_THRESHOLD: {
    description: 'Min confidence (0-1) to keep an audio event',
    widget: 'slider',
  },
  AUDIO_CLIP_PRE_ROLL: { description: 'Seconds before audio event for clip', widget: 'number' },
  AUDIO_CLIP_POST_ROLL: { description: 'Seconds after audio event for clip', widget: 'number' },
  AUDIO_LLM_BOOST_WINDOW: {
    description: 'Time window for audio-to-LLM score boosting',
    widget: 'number',
  },
  AUDIO_LLM_SCORE_BOOST: {
    description: 'Score boost when audio event near LLM segment',
    widget: 'number',
  },
  GAME_PROFILE: { description: 'Game-specific event detection profile', widget: 'select' },
  DOWNLOAD_SECTIONS_MODE: {
    description: 'yt-dlp download mode ("all" or section count)',
    widget: 'text',
  },
  PARTIAL_DOWNLOAD_ENABLED: {
    description:
      'Download only the clipped portion via yt-dlp --download-sections instead of the full video. Lossless output — no re-encode.',
    widget: 'toggle',
  },
  FFMPEG_PATH: { description: 'Custom ffmpeg binary path (empty = auto-detect)', widget: 'text' },
  FFPROBE_PATH: { description: 'Custom ffprobe binary path (empty = auto-detect)', widget: 'text' },
  FFMPEG_PRESET: { description: 'Encoding speed/quality trade-off', widget: 'select' },
  TIMESTAMP_OFFSET_SECONDS: {
    description: 'Adjust all clip timestamps if transcript misaligned',
    widget: 'number',
  },
  DOWNLOAD_DIR: { description: 'yt-dlp output directory', widget: 'text' },
  OUTPUT_DIR: { description: 'Clips, dumps, artifacts directory', widget: 'text' },
  CACHE_DIR: { description: 'File-based cache directory', widget: 'text' },
  DUMP_OUTPUTS: {
    description: 'Write transcript + analysis JSON files after each run',
    widget: 'toggle',
  },
  CLIP_CONCURRENCY: { description: 'Max parallel clip generation operations', widget: 'number' },
  LOG_COLOR: {
    description: 'Enable ANSI color in log output (set LOG_COLOR=false to disable)',
    widget: 'toggle',
  },
  CACHE_BACKEND: { description: 'Cache storage backend', widget: 'select' },
  MONGODB_URI: {
    description: 'MongoDB connection URI (required if backend=mongodb)',
    widget: 'text',
    secret: true,
  },
  MONGODB_DATABASE: { description: 'MongoDB database name', widget: 'text' },
  CACHE_TTL_SECONDS: { description: 'Cache TTL in seconds (0 = no expiry)', widget: 'number' },
  YT_DEFAULT_CATEGORY_ID: {
    description:
      'Default YouTube category ID for new publish drafts (e.g. 22=People & Blogs, 27=Education, 28=Science & Technology)',
    widget: 'text',
    placeholder: '22',
  },
  YT_DEFAULT_PRIVACY: {
    description: 'Default privacy status for new publish draft items',
    widget: 'select',
  },
  YT_DEFAULT_LICENSE: {
    description: 'Default license for new publish draft items',
    widget: 'select',
  },
  YT_DEFAULT_MADE_FOR_KIDS: {
    description: 'Default "made for kids" (COPPA) flag for new publish draft items',
    widget: 'toggle',
  },
  YT_DEFAULT_EMBEDDABLE: {
    description: 'Default embeddable setting for new publish draft items',
    widget: 'toggle',
  },
  YT_DEFAULT_PUBLIC_STATS_VIEWABLE: {
    description: 'Default public stats visibility for new publish draft items',
    widget: 'toggle',
  },
  YT_DEFAULT_CONTAINS_SYNTHETIC_MEDIA: {
    description: 'Default AI-generated content disclosure for new publish draft items',
    widget: 'toggle',
  },
  YT_DEFAULT_IS_SHORT: {
    description: 'Default format for new publish draft items — enable to upload as YouTube Shorts',
    widget: 'toggle',
  },
  YT_SCHEDULE_ENABLED: {
    description: 'Enable scheduled publishing — stagger clip publish times using YouTube publishAt',
    widget: 'toggle',
  },
  YT_SCHEDULE_INTERVAL_MIN: {
    description:
      'Minutes between scheduled clip publish times (used in bulk schedule on Prepare page)',
    widget: 'number',
  },
};
