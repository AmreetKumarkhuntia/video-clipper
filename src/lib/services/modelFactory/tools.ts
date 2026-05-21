import { tool, zodSchema } from 'ai';
import type { z } from 'zod';
import type { DefineToolOpts } from '@lib/types/modelFactory.js';

export function defineTool<TSchema extends z.ZodType>(opts: DefineToolOpts<TSchema>) {
  return tool({
    description: opts.description,
    inputSchema: zodSchema(opts.inputSchema),
    execute: opts.execute as never,
  });
}
