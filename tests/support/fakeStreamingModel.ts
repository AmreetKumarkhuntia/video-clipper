import { vi, type Mock } from 'vitest';
import type { Model, ModelStreamTextOpts } from '@lib/types/modelFactory.js';

export interface FakeStreamScenario {
  error?: Error;
  input?: unknown;
  textDeltas?: string[];
  toolName?: string;
}

export interface FakeStreamingModel {
  model: Model;
  streamText: Mock;
}

export function createFakeStreamingModel(scenarios: FakeStreamScenario[]): FakeStreamingModel {
  const remaining = [...scenarios];
  const streamText = vi.fn((_opts: ModelStreamTextOpts): ReturnType<Model['streamText']> => {
    const scenario = remaining.shift();

    if (!scenario) {
      throw new Error('No fake stream scenario configured');
    }
    if (scenario.error) {
      throw scenario.error;
    }

    const textDeltas = scenario.textDeltas ?? [];

    async function* fullStream(): AsyncGenerator<
      { type: 'text-delta'; text: string },
      void,
      unknown
    > {
      for (const text of textDeltas) {
        yield { type: 'text-delta' as const, text };
      }
    }

    return {
      fullStream: fullStream(),
      staticToolCalls: Promise.resolve([
        {
          toolName: scenario.toolName ?? 'report_analysis',
          input: scenario.input,
        },
      ]),
    } as unknown as ReturnType<Model['streamText']>;
  });

  return {
    model: { streamText } as unknown as Model,
    streamText,
  };
}
