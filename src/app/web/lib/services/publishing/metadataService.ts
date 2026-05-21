import pLimit from 'p-limit';
import { Model, defineTool } from '@lib/services/modelFactory/index.js';
import { log } from '@lib/utils/logger.js';
import {
  YOUTUBE_CATEGORIES,
  GeneratedPublishMetadataSchema,
  type GeneratedPublishMetadata,
  type PublishDraftItem,
  type MetadataGenerationContext,
} from '@app/web/types/publish.js';
import type { Config } from '@lib/types/config.js';
import { readMetadataCache, writeMetadataCache } from './metadataCache.js';

export type { MetadataGenerationContext } from '@app/web/types/publish.js';

import { PublishMetadataSchema } from '@app/web/types/publish.js';

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
  Default to "22" (People & Blogs) when the content does not fit a more specific category.
- If Format is "YouTube Short": keep the title under 60 chars and the description under 300 chars; lead with the most compelling line first.
- If Format is "YouTube Video": standard YouTube title and description length rules apply.`;

export async function generatePublishMetadata(
  workflowTitle: string,
  items: PublishDraftItem[],
  cfg: Config,
  context?: MetadataGenerationContext,
  requestId?: string,
): Promise<GeneratedPublishMetadata[]> {
  const done = log.fnCalled('generatePublishMetadata', requestId, { items: items.length });

  const concurrency = Math.max(1, Math.min(cfg.LLM_CONCURRENCY, 2));
  const model = new Model({
    provider: cfg.LLM_PROVIDER,
    model: cfg.LLM_MODEL,
    apiKeys: {
      ZAI_API_KEY: cfg.ZAI_API_KEY,
      OPENROUTER_API_KEY: cfg.OPENROUTER_API_KEY,
      CUSTOM_OPENAI_BASE_URL: cfg.CUSTOM_OPENAI_BASE_URL,
      CUSTOM_OPENAI_API_KEY: cfg.CUSTOM_OPENAI_API_KEY,
    },
  });
  log.info(
    'generatePublishMetadata',
    `[publish-metadata] model=${cfg.LLM_PROVIDER}/${cfg.LLM_MODEL} concurrency=${concurrency}`,
    requestId,
  );
  const limit = pLimit(concurrency);
  const effectiveSystemPrompt =
    cfg.PUBLISH_METADATA_SYSTEM_PROMPT ?? DEFAULT_METADATA_SYSTEM_PROMPT;

  const jobs = items.map((item, itemIndex) =>
    limit(async () => {
      const label = `clip ${itemIndex + 1}/${items.length} ${item.filename}`;
      const t0 = Date.now();
      log.info(
        'generatePublishMetadata',
        `[publish-metadata] → ${label} (${item.startSec.toFixed(1)}s–${item.endSec.toFixed(1)}s)`,
        requestId,
      );

      const prompt = buildMetadataPrompt(workflowTitle, item, context);

      const cached = await readMetadataCache(cfg.CACHE_DIR, effectiveSystemPrompt, prompt);
      if (cached) {
        log.info('generatePublishMetadata', `[publish-metadata] cache hit for ${label}`, requestId);
        return GeneratedPublishMetadataSchema.parse({
          clipArtifactId: item.clipArtifactId,
          ...cached,
        });
      }
      log.info(
        'generatePublishMetadata',
        `[publish-metadata] cache miss for ${label} — calling LLM`,
        requestId,
      );

      const result = await model.generateText({
        system: effectiveSystemPrompt,
        prompt,
        tools: {
          register_metadata: defineTool({
            description: 'Register YouTube clip upload metadata',
            inputSchema: PublishMetadataSchema,
          }),
        },
        toolChoice: { type: 'tool', toolName: 'register_metadata' },
        maxRetries: cfg.LLM_MAX_RETRIES,
      });

      log.info(
        'generatePublishMetadata',
        `[publish-metadata] ← ${label} toolCalls=${result.toolCalls.length} finishReason=${result.finishReason} (${Date.now() - t0}ms)`,
        requestId,
      );

      const toolCall = result.toolCalls.find((tc) => tc.toolName === 'register_metadata');
      if (!toolCall) {
        const names = result.toolCalls.map((tc) => tc.toolName).join(', ') || 'none';
        log.error(
          'generatePublishMetadata',
          `[publish-metadata] no register_metadata call for ${label} — toolCalls=[${names}] finishReason=${result.finishReason}`,
          requestId,
        );
        throw new Error('No metadata registered: model did not call register_metadata');
      }

      const metadata = GeneratedPublishMetadataSchema.parse({
        clipArtifactId: item.clipArtifactId,
        ...(toolCall.input as Record<string, unknown>),
      });
      log.info(
        'generatePublishMetadata',
        `[publish-metadata] ✓ ${label} title="${metadata.title}" category=${metadata.categoryId} tags=${metadata.tags.length}`,
        requestId,
      );

      await writeMetadataCache(cfg.CACHE_DIR, effectiveSystemPrompt, prompt, {
        title: metadata.title,
        description: metadata.description,
        tags: metadata.tags,
        categoryId: metadata.categoryId,
      });

      return metadata;
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
    log.error(
      'generatePublishMetadata',
      `[publish-metadata] ✗ clip ${index + 1}/${items.length} ${item.filename}: ${reason}`,
      requestId,
    );
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
Format: ${item.isShort ? 'YouTube Short' : 'YouTube Video'}
Current title draft: ${item.title || 'none'}
Current description draft: ${item.description || 'none'}
Current categoryId: ${item.categoryId}
Transcript excerpt (primary source of truth):
${item.transcriptExcerpt || 'No excerpt available.'}

Return metadata that is ready to upload to YouTube, including the most appropriate categoryId.`;
}
