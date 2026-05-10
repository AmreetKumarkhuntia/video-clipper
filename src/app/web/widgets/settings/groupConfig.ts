import type { SectionConfig, GroupConfig } from '@app/web/types/web.js';

export type { SectionConfig, GroupConfig };

export const GROUP_CONFIG: Record<string, GroupConfig> = {
  llm: {
    icon: 'sparkles',
    subtitle: 'Which model scores transcript chunks and refines clip boundaries.',
    sections: [
      {
        h3: 'Provider',
        meta: 'used for scoring + refinement',
        fields: ['LLM_PROVIDER', 'LLM_MODEL'],
      },
      {
        h3: 'Performance',
        meta: 'concurrency and retry settings',
        fields: ['LLM_MAX_RETRIES', 'LLM_CONCURRENCY'],
        layout: 'two',
      },
      {
        h3: 'System prompts',
        meta: 'leave blank to use the built-in defaults',
        fields: ['LLM_SYSTEM_PROMPT', 'PUBLISH_METADATA_SYSTEM_PROMPT'],
      },
    ],
  },

  'api-keys': {
    icon: 'key',
    subtitle: 'API keys for each LLM provider. Stored locally and never sent to our servers.',
    sections: [
      {
        h3: 'Credentials',
        meta: 'stored locally · never leaves your machine',
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
    ],
  },

  youtube: {
    icon: 'youtube',
    subtitle: 'YouTube Data API credentials, yt-dlp behaviour, and upload defaults.',
    sections: [
      {
        h3: 'API credentials',
        meta: 'required for channel search and video uploads',
        fields: [
          'YOUTUBE_API_KEY',
          'YOUTUBE_OAUTH_CLIENT_ID',
          'YOUTUBE_OAUTH_CLIENT_SECRET',
          'YOUTUBE_OAUTH_REDIRECT_URI',
        ],
      },
      {
        h3: 'yt-dlp',
        meta: 'download client behaviour and network options',
        fields: [
          'YT_DLP_COOKIES_FROM_BROWSER',
          'YT_DLP_COOKIES_FILE',
          'YT_DLP_RETRY_COUNT',
          'YT_DLP_SLEEP_REQUESTS',
          'YT_DLP_PLAYER_CLIENT',
          'YT_DLP_QUIET',
          'YT_DLP_SEGMENT_COOKIES_ENABLED',
          'YT_DLP_NO_CHECK_CERTIFICATES',
          'YT_DLP_FORCE_IPV4',
          'YT_DLP_GEO_BYPASS',
        ],
      },
      {
        h3: 'Upload defaults',
        meta: 'applied to every YouTube clip upload',
        fields: [
          'YT_DEFAULT_CATEGORY_ID',
          'YT_DEFAULT_PRIVACY',
          'YT_DEFAULT_LICENSE',
          'YT_DEFAULT_MADE_FOR_KIDS',
          'YT_DEFAULT_EMBEDDABLE',
          'YT_DEFAULT_PUBLIC_STATS_VIEWABLE',
          'YT_DEFAULT_CONTAINS_SYNTHETIC_MEDIA',
          'YT_DEFAULT_IS_SHORT',
        ],
      },
    ],
  },

  chunking: {
    icon: 'crop',
    subtitle: 'Controls how transcripts are split into windows before LLM analysis.',
    sections: [
      {
        h3: 'Window sizes',
        meta: 'how transcript is split for LLM analysis',
        fields: ['CHUNK_LENGTH_SEC', 'CHUNK_OVERLAP_SEC', 'MICRO_BLOCK_SEC', 'MAX_CHUNKS'],
        layout: 'two',
      },
    ],
  },

  selection: {
    icon: 'gauge',
    subtitle: 'Score threshold and result count applied after LLM scoring.',
    sections: [
      {
        h3: 'Scoring',
        meta: 'filters and limits applied after LLM scoring',
        fields: ['SCORE_THRESHOLD', 'TOP_N_SEGMENTS'],
        layout: 'two',
      },
    ],
  },

  transcript: {
    icon: 'captions',
    subtitle: 'Where transcripts are sourced from for each video.',
    sections: [
      {
        h3: 'Provider',
        meta: 'comma-separated list of providers to try in order',
        fields: ['TRANSCRIPT_PROVIDER'],
      },
    ],
  },

  audio: {
    icon: 'volume',
    subtitle: 'Audio event detection to boost segments with audible reactions.',
    sections: [
      {
        h3: 'Detection',
        meta: 'provider and game profile for audio analysis',
        fields: ['AUDIO_DETECTION_ENABLED', 'AUDIO_PROVIDER', 'GAME_PROFILE'],
      },
      {
        h3: 'Whisper',
        meta: 'model and confidence threshold for local transcription',
        fields: ['AUDIO_WHISPER_MODEL', 'AUDIO_CONFIDENCE_THRESHOLD'],
        layout: 'two',
      },
      {
        h3: 'Score boosting',
        meta: 'how audio events influence the final segment score',
        fields: [
          'AUDIO_CLIP_PRE_ROLL',
          'AUDIO_CLIP_POST_ROLL',
          'AUDIO_LLM_BOOST_WINDOW',
          'AUDIO_LLM_SCORE_BOOST',
        ],
        layout: 'two',
      },
      {
        h3: 'Gemini',
        meta: 'model and extra instructions for the Gemini audio provider',
        fields: ['AUDIO_GEMINI_MODEL', 'AUDIO_EXTRA_INSTRUCTIONS'],
      },
    ],
  },

  ffmpeg: {
    icon: 'scissors',
    subtitle: 'FFmpeg binary paths, encoding preset, and download behaviour.',
    sections: [
      {
        h3: 'Paths',
        meta: 'leave blank to use $PATH',
        fields: ['FFMPEG_PATH', 'FFPROBE_PATH'],
        layout: 'two',
      },
      {
        h3: 'Encoding',
        meta: 'how clips are cut and encoded',
        fields: ['FFMPEG_PRESET', 'TIMESTAMP_OFFSET_SECONDS', 'DOWNLOAD_SECTIONS_MODE'],
        layout: 'two',
      },
      {
        h3: 'Behaviour',
        fields: ['PARTIAL_DOWNLOAD_ENABLED'],
      },
    ],
  },

  output: {
    icon: 'folder',
    subtitle: 'Where downloads, rendered clips, and cached data are written.',
    sections: [
      {
        h3: 'Directories',
        fields: ['DOWNLOAD_DIR', 'OUTPUT_DIR', 'CACHE_DIR'],
        layout: 'two',
      },
      {
        h3: 'Behaviour',
        fields: ['DUMP_OUTPUTS', 'CLIP_CONCURRENCY'],
      },
    ],
  },

  cache: {
    icon: 'database',
    subtitle: 'Cache backend for transcript and LLM analysis results.',
    sections: [
      {
        h3: 'Backend',
        fields: ['CACHE_BACKEND'],
      },
      {
        h3: 'MongoDB',
        meta: 'only used when backend is set to mongodb',
        fields: ['MONGODB_URI', 'MONGODB_DATABASE'],
        layout: 'two',
      },
      {
        h3: 'TTL',
        meta: 'how long cached results are kept',
        fields: ['CACHE_TTL_SECONDS'],
      },
    ],
  },
};
