import { eq } from 'drizzle-orm';
import { getDb } from '../client.js';
import { publishDrafts } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { PublishDraftItemSchema } from '@lib/types/publish.js';
import type { PublishDraft } from '@lib/types/publish.js';

function rowToDraft(row: typeof publishDrafts.$inferSelect): PublishDraft {
  return {
    id: row.id,
    analysisId: row.analysisId,
    videoId: row.videoId,
    title: row.title,
    items: PublishDraftItemSchema.array().parse(row.itemsJson),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function upsertPublishDraft(draft: PublishDraft): Promise<void> {
  const done = log.dbCalled('upsertPublishDraft', undefined, { analysisId: draft.analysisId });
  const now = new Date();
  await getDb()
    .insert(publishDrafts)
    .values({
      id: draft.id,
      analysisId: draft.analysisId,
      videoId: draft.videoId,
      title: draft.title,
      itemsJson: PublishDraftItemSchema.array().parse(draft.items),
      createdAt: new Date(draft.createdAt),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: publishDrafts.analysisId,
      set: {
        title: draft.title,
        itemsJson: PublishDraftItemSchema.array().parse(draft.items),
        updatedAt: now,
      },
    })
    .returning({ id: publishDrafts.id });
  done({});
}

export async function getPublishDraftByAnalysisId(
  analysisId: string,
): Promise<PublishDraft | null> {
  const done = log.dbCalled('getPublishDraftByAnalysisId', undefined, { analysisId });
  const [row] = await getDb()
    .select()
    .from(publishDrafts)
    .where(eq(publishDrafts.analysisId, analysisId))
    .limit(1);
  done({ found: row ? 1 : 0 });
  return row ? rowToDraft(row) : null;
}
