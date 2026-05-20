import { eq } from 'drizzle-orm';
import { db } from '../client.js';
import { publishDrafts } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import { PublishDraftItemSchema } from '@app/web/types/publish.js';
import type { PublishDraft } from '@app/web/types/publish.js';

function rowToDraft(row: typeof publishDrafts.$inferSelect): PublishDraft {
  return {
    id: row.id,
    analysisId: row.analysisId,
    videoId: row.videoId,
    title: row.title,
    items: (JSON.parse(row.itemsJson) as unknown[]).map((i) => PublishDraftItemSchema.parse(i)),
    createdAt: new Date(row.createdAt).toISOString(),
    updatedAt: new Date(row.updatedAt).toISOString(),
  };
}

export function upsertPublishDraft(draft: PublishDraft): void {
  const done = log.dbCalled('upsertPublishDraft', undefined, { analysisId: draft.analysisId });
  const now = Date.now();
  db.insert(publishDrafts)
    .values({
      id: draft.id,
      analysisId: draft.analysisId,
      videoId: draft.videoId,
      title: draft.title,
      itemsJson: JSON.stringify(draft.items),
      createdAt: new Date(draft.createdAt).getTime(),
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: publishDrafts.analysisId,
      set: {
        title: draft.title,
        itemsJson: JSON.stringify(draft.items),
        updatedAt: now,
      },
    })
    .run();
  done({});
}

export function getPublishDraftByAnalysisId(analysisId: string): PublishDraft | null {
  const done = log.dbCalled('getPublishDraftByAnalysisId', undefined, { analysisId });
  const row = db.select().from(publishDrafts).where(eq(publishDrafts.analysisId, analysisId)).get();
  done({ found: row ? 1 : 0 });
  return row ? rowToDraft(row) : null;
}
