import { z } from 'zod';

export const ConfigSchema = z.object({
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  SCORE_THRESHOLD: z.coerce.number().min(1).max(10).default(7),
  TOP_N_SEGMENTS: z.coerce.number().min(1).default(10),
  CHUNK_LENGTH_SEC: z.coerce.number().min(10).default(120),
  CHUNK_OVERLAP_SEC: z.coerce.number().min(0).default(20),
  MICRO_BLOCK_SEC: z.coerce.number().min(5).default(15),
  LLM_MODEL: z.string().default('gpt-4o'),
  LLM_MAX_RETRIES: z.coerce.number().min(0).default(3),
  DOWNLOAD_DIR: z.string().default('downloads/'),
  OUTPUT_DIR: z.string().default('outputs/'),
});

export type Config = z.infer<typeof ConfigSchema>;
