import {
  generateText as aiGenerateText,
  streamText as aiStreamText,
  generateObject,
  streamObject,
  experimental_generateSpeech,
  experimental_transcribe,
  zodSchema,
  type LanguageModel,
} from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import type { z } from 'zod';
import type {
  ModelOpts,
  ModelGenerateTextOpts,
  ModelStreamTextOpts,
  ModelGenerateJSONOpts,
  ModelStreamJSONOpts,
  AudioModelOpts,
  GenerateSpeechOpts,
  TranscribeOpts,
} from '@lib/types/modelFactory.js';
import { resolveLanguageModel } from './providers.js';

export class Model {
  private readonly lm: LanguageModel;

  constructor(opts: ModelOpts) {
    this.lm = resolveLanguageModel(opts.provider, opts.model, opts.apiKeys);
  }

  generateText(opts: ModelGenerateTextOpts) {
    return aiGenerateText({ ...opts, model: this.lm } as Parameters<typeof aiGenerateText>[0]);
  }

  streamText(opts: ModelStreamTextOpts) {
    return aiStreamText({ ...opts, model: this.lm } as Parameters<typeof aiStreamText>[0]);
  }

  async generateJSON<TSchema extends z.ZodType>(
    opts: ModelGenerateJSONOpts<TSchema>,
  ): Promise<z.infer<TSchema>> {
    const result = await generateObject({
      model: this.lm,
      schema: zodSchema(opts.schema),
      prompt: opts.prompt,
      system: opts.system,
      messages: opts.messages,
      maxRetries: opts.maxRetries,
      abortSignal: opts.abortSignal,
    } as Parameters<typeof generateObject>[0]);
    return result.object as z.infer<TSchema>;
  }

  streamJSON<TSchema extends z.ZodType>(opts: ModelStreamJSONOpts<TSchema>) {
    return streamObject({
      model: this.lm,
      schema: zodSchema(opts.schema),
      prompt: opts.prompt,
      system: opts.system,
      messages: opts.messages,
      maxRetries: opts.maxRetries,
      abortSignal: opts.abortSignal,
    } as Parameters<typeof streamObject>[0]);
  }
}

export class AudioModel {
  private readonly client: ReturnType<typeof createOpenAI>;
  private readonly defaults: { tts: string; stt: string; voice: string };

  constructor(opts: AudioModelOpts) {
    this.client = createOpenAI({ apiKey: opts.openaiApiKey });
    this.defaults = {
      tts: opts.tts ?? 'tts-1',
      stt: opts.stt ?? 'whisper-1',
      voice: opts.voice ?? 'alloy',
    };
  }

  generateSpeech(opts: GenerateSpeechOpts) {
    return experimental_generateSpeech({
      model: this.client.speech(opts.model ?? this.defaults.tts),
      text: opts.text,
      voice: opts.voice ?? this.defaults.voice,
    });
  }

  transcribe(opts: TranscribeOpts) {
    return experimental_transcribe({
      model: this.client.transcription(opts.model ?? this.defaults.stt),
      audio: opts.audio,
    });
  }
}
