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

export interface SelectOption<T extends string> {
  value: T;
  label: string;
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

// The settings contract is shared with the backend and the CLI, so it lives in
// @lib/types/api.js; these names stay so existing web callers keep working.
export type {
  SettingsResponse as ConfigApiResponse,
  SettingsUpdateResponse as ConfigUpdateResponse,
} from '@lib/types/api.js';

export const ConfigUpdateSchema = z.record(z.string(), z.unknown());
