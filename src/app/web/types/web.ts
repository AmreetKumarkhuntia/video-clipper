import { z } from 'zod';

export const ApiErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    detail: z.string().optional(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

export interface WebServerConfig {
  youtubeApiKey: string | undefined;
  outputDir: string;
  cacheDir: string;
  defaultThreshold: number;
  defaultTopN: number;
  defaultConcurrency: number;
}

export interface SectionConfig {
  h3: string;
  meta?: string;
  fields: string[];
  layout?: 'two';
}

export interface GroupConfig {
  icon: string;
  subtitle: string;
  sections: SectionConfig[];
}

export interface ConfigApiResponse {
  registry: import('@lib/types/config.js').ConfigRegistryResponse;
  values: Record<string, unknown>;
}

export interface ConfigUpdateResponse {
  success: boolean;
  warnings: string[];
  values: Record<string, unknown>;
}

export const ConfigUpdateSchema = z.record(z.string(), z.unknown());
