import { CONFIG_GROUPS, CONFIG_FIELD_META, type ConfigWidget } from '@lib/types/config.js';
import { config } from '@lib/config/env.js';

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

const FIELD_CONSTRAINTS: Record<
  string,
  { min?: number; max?: number; options?: string[]; optionLabels?: string[] }
> = {
  LLM_PROVIDER: {
    options: [
      'openai',
      'anthropic',
      'google',
      'xai',
      'mistral',
      'groq',
      'zai',
      'openrouter',
      'custom',
    ],
  },
  SCORE_THRESHOLD: { min: 1, max: 10 },
  TOP_N_SEGMENTS: { min: 1 },
  CHUNK_LENGTH_SEC: { min: 10 },
  CHUNK_OVERLAP_SEC: { min: 0 },
  MICRO_BLOCK_SEC: { min: 5 },
  LLM_MAX_RETRIES: { min: 0 },
  LLM_CONCURRENCY: { min: 1 },
  MAX_CHUNKS: { min: 1 },
  CLIP_CONCURRENCY: { min: 1 },
  YT_DLP_RETRY_COUNT: { min: 0, max: 5 },
  YT_DLP_SLEEP_REQUESTS: { min: 0, max: 30 },
  YT_DLP_PLAYER_CLIENT: {
    options: ['auto', 'android_vr', 'mweb', 'web', 'android', 'ios'],
    optionLabels: [
      'Auto (yt-dlp default)',
      'Android VR (bypass bot-check)',
      'Mobile Web',
      'Desktop Web',
      'Android',
      'iOS',
    ],
  },
  AUDIO_CONFIDENCE_THRESHOLD: { min: 0, max: 1 },
  AUDIO_CLIP_PRE_ROLL: { min: 0 },
  AUDIO_CLIP_POST_ROLL: { min: 0 },
  AUDIO_LLM_BOOST_WINDOW: { min: 0 },
  AUDIO_LLM_SCORE_BOOST: { min: 0 },
  AUDIO_WHISPER_MODEL: { options: ['tiny', 'base', 'small', 'medium', 'large-v3'] },
  GAME_PROFILE: { options: ['valorant', 'fps', 'boss_fight', 'general'] },
  FFMPEG_PRESET: {
    options: ['ultrafast', 'superfast', 'veryfast', 'fast', 'medium', 'slow', 'slower'],
  },
  CACHE_BACKEND: { options: ['file', 'mongodb'] },
  CACHE_TTL_SECONDS: { min: 0 },
  TIMESTAMP_OFFSET_SECONDS: {},
  YT_DEFAULT_CATEGORY_ID: {
    options: [
      '1',
      '2',
      '10',
      '15',
      '17',
      '19',
      '20',
      '22',
      '23',
      '24',
      '25',
      '26',
      '27',
      '28',
      '29',
    ],
    optionLabels: [
      'Film & Animation',
      'Autos & Vehicles',
      'Music',
      'Pets & Animals',
      'Sports',
      'Travel & Events',
      'Gaming',
      'People & Blogs',
      'Comedy',
      'Entertainment',
      'News & Politics',
      'How-to & Style',
      'Education',
      'Science & Technology',
      'Nonprofits & Activism',
    ],
  },
  YT_DEFAULT_PRIVACY: { options: ['private', 'unlisted', 'public'] },
  YT_DEFAULT_LICENSE: {
    options: ['youtube', 'creativeCommon'],
    optionLabels: ['Standard YouTube License', 'Creative Commons — Attribution'],
  },
};

const REQUIRED_FIELDS = new Set(['LLM_PROVIDER', 'LLM_MODEL']);

const SECRET_FIELDS = new Set(
  Object.entries(CONFIG_FIELD_META)
    .filter(([, m]) => m.secret)
    .map(([k]) => k),
);

function getDefaultValue(key: string): unknown {
  const envValue = (config as Record<string, unknown>)[key];
  if (envValue !== undefined) return envValue;
  return undefined;
}

function makeLabel(key: string): string {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/ Api /g, ' API ')
    .replace(/ Yt Dlp /g, ' yt-dlp ');
}

function buildFieldDescriptor(key: string): ConfigFieldDescriptor | null {
  const meta = CONFIG_FIELD_META[key];
  if (!meta) return null;

  const constraints = FIELD_CONSTRAINTS[key] ?? {};

  return {
    key,
    label: makeLabel(key),
    description: meta.description,
    widget: meta.widget,
    required: REQUIRED_FIELDS.has(key),
    secret: SECRET_FIELDS.has(key),
    defaultValue: SECRET_FIELDS.has(key) ? undefined : getDefaultValue(key),
    min: constraints.min,
    max: constraints.max,
    options: constraints.options,
    optionLabels: constraints.optionLabels,
    placeholder: meta.placeholder,
  };
}

let cachedRegistry: ConfigRegistryResponse | null = null;

export function buildConfigRegistry(): ConfigRegistryResponse {
  if (cachedRegistry) return cachedRegistry;

  const groups: ConfigGroupDescriptor[] = [];

  for (const group of CONFIG_GROUPS) {
    const fields: ConfigFieldDescriptor[] = [];

    for (const key of group.fields) {
      const descriptor = buildFieldDescriptor(key);
      if (descriptor) fields.push(descriptor);
    }

    groups.push({ id: group.id, label: group.label, fields });
  }

  cachedRegistry = { groups };
  return cachedRegistry;
}
