import type { z } from 'zod';
import type { generateText, streamText, experimental_transcribe } from 'ai';
import type { ModelFactoryApiKeys } from './config.js';

export interface ModelOpts {
  provider: string;
  model: string;
  apiKeys: ModelFactoryApiKeys;
}

export type ModelGenerateTextOpts = Omit<Parameters<typeof generateText>[0], 'model'>;
export type ModelStreamTextOpts = Omit<Parameters<typeof streamText>[0], 'model'>;

export interface ModelGenerateJSONOpts<TSchema extends z.ZodType> {
  schema: TSchema;
  prompt?: string;
  system?: string;
  messages?: ModelGenerateTextOpts['messages'];
  maxRetries?: number;
  abortSignal?: AbortSignal;
}

export type ModelStreamJSONOpts<TSchema extends z.ZodType> = ModelGenerateJSONOpts<TSchema>;

export interface AudioModelOpts {
  openaiApiKey: string;
  tts?: string;
  stt?: string;
  voice?: string;
}

export interface GenerateSpeechOpts {
  text: string;
  voice?: string;
  model?: string;
}

export interface TranscribeOpts {
  audio: Parameters<typeof experimental_transcribe>[0]['audio'];
  model?: string;
}

export interface DefineToolOpts<TSchema extends z.ZodType> {
  description: string;
  inputSchema: TSchema;
  execute?: (input: z.infer<TSchema>) => unknown | Promise<unknown>;
}
