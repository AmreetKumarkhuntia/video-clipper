import { generateObject } from 'ai';
import pLimit from 'p-limit';
import { z } from 'zod';
import { getModel } from '@lib/utils/modelFactory.js';
import { log } from '@lib/utils/logger.js';
import {
  YOUTUBE_CATEGORIES,
  GeneratedPublishMetadataSchema,
  type GeneratedPublishMetadata,
  type PublishDraftItem,
  type MetadataGenerationContext,
} from '@app/web/types/publish.js';
import type { Config } from '@lib/types/config.js';

export type { MetadataGenerationContext } from '@app/web/types/publish.js';

const PublishMetadataSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().min(1).max(5000),
  tags: z.array(z.string().min(1).max(30)).max(15),
  categoryId: z.string().min(1).max(5),
});

const CATEGORY_LIST = Object.entries(YOUTUBE_CATEGORIES)
  .map(([id, label]) => `${id}=${label}`)
  .join(', ');

const DEFAULT_METADATA_SYSTEM_PROMPT = `You are a YouTube shorts and clips editor.

Generate strong, natural metadata for a short uploaded clip.

Rules:
- The transcript excerpt is the primary source of truth for what happens in the clip.
- The video title and description are minor supporting context — use them to inform tone and topic, not to invent facts.
- The title should be concise, specific, and clickable without being spammy.
- The description should summarize the moment and preserve important context.
- Tags should be short, useful search terms with no hashtags.
- Avoid quotation marks unless they are necessary.
- Do not invent facts that are not supported by the provided clip context.
- For categoryId, pick the single most relevant YouTube category ID from this list:
  ${CATEGORY_LIST}
  Default to "22" (People & Blogs) when the content does not fit a more specific category.`;

export async function generatePublishMetadata(
  workflowTitle: string,
  items: PublishDraftItem[],
  cfg: Config,
  context?: MetadataGenerationContext,
  requestId?: string,
): Promise<GeneratedPublishMetadata[]> {
  const done = log.fnCalled('generatePublishMetadata', { items: items.length }, requestId);

  const model = getModel(cfg.LLM_PROVIDER, cfg.LLM_MODEL, {
    ZAI_API_KEY: cfg.ZAI_API_KEY,
    OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
    CUSTOM_OPENAI_BASE_URL: cfg.CUSTOM_OPENAI_BASE_URL,
    CUSTOM_OPENAI_API_KEY: cfg.CUSTOM_OPENAI_API_KEY,
  });
  const limit = pLimit(Math.max(1, Math.min(cfg.LLM_CONCURRENCY, 2)));

  const jobs = items.map((item) =>
    limit(async () => {
      const result = await generateObject({
        model,
        system: cfg.PUBLISH_METADATA_SYSTEM_PROMPT ?? DEFAULT_METADATA_SYSTEM_PROMPT,
        prompt: buildMetadataPrompt(workflowTitle, item, context),
        schema: PublishMetadataSchema,
        schemaName: 'PublishMetadata',
        schemaDescription: 'YouTube clip upload metadata',
        maxRetries: cfg.LLM_MAX_RETRIES,
      });

      return GeneratedPublishMetadataSchema.parse({
        clipArtifactId: item.clipArtifactId,
        ...result.object,
      });
    }),
  );

  const results = await Promise.allSettled(jobs);
  const generated: GeneratedPublishMetadata[] = [];

  for (let index = 0; index < results.length; index++) {
    const result = results[index];
    const item = items[index];

    if (result.status === 'fulfilled') {
      generated.push(result.value);
      continue;
    }

    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
    log.warn(`[publish-metadata] failed for ${item.filename}: ${reason}`);
  }

  done({ generated: generated.length });
  return generated;
}

function buildMetadataPrompt(
  workflowTitle: string,
  item: PublishDraftItem,
  context?: MetadataGenerationContext,
): string {
  const contextLines: string[] = [];

  if (context?.sourceChannelTitle)
    contextLines.push(`Source channel: ${context.sourceChannelTitle}`);
  if (context?.uploadChannelName) contextLines.push(`Upload channel: ${context.uploadChannelName}`);
  if (context?.videoDescription) {
    const trimmed = context.videoDescription.trim().slice(0, 500);
    contextLines.push(`Source video description (minor context):\n${trimmed}`);
  }

  const contextBlock = contextLines.length > 0 ? `${contextLines.join('\n')}\n\n` : '';

  return `${contextBlock}Workflow title: ${workflowTitle}
Clip file: ${item.filename}
Clip timing: ${item.startSec.toFixed(1)}s to ${item.endSec.toFixed(1)}s
Current title draft: ${item.title || 'none'}
Current description draft: ${item.description || 'none'}
Current categoryId: ${item.categoryId}
Transcript excerpt (primary source of truth):
${item.transcriptExcerpt || 'No excerpt available.'}

Return metadata that is ready to upload to YouTube, including the most appropriate categoryId.`;
}
