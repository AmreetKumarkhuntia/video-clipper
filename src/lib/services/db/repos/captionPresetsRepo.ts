import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { getDb } from '../client.js';
import { captionPresets } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { CaptionPresetRecord, CaptionPresetInsert } from '@lib/types/db.js';
import { PositionSchema, TextStyleSchema } from '@lib/types/clipEdit.js';

function rowToRecord(row: typeof captionPresets.$inferSelect): CaptionPresetRecord {
  return {
    id: row.id,
    name: row.name,
    style: JSON.stringify(TextStyleSchema.parse(row.style)),
    position: JSON.stringify(PositionSchema.parse(row.position)),
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  };
}

export async function listCaptionPresets(): Promise<CaptionPresetRecord[]> {
  const done = log.dbCalled('listCaptionPresets', undefined, {});
  const rows = await getDb().select().from(captionPresets).orderBy(captionPresets.createdAt);
  done({ found: rows.length });
  return rows.map(rowToRecord);
}

export async function getCaptionPreset(id: string): Promise<CaptionPresetRecord | null> {
  const done = log.dbCalled('getCaptionPreset', undefined, { id });
  const [row] = await getDb()
    .select()
    .from(captionPresets)
    .where(eq(captionPresets.id, id))
    .limit(1);
  done({ found: row ? 1 : 0 });
  return row ? rowToRecord(row) : null;
}

export async function createCaptionPreset(
  input: CaptionPresetInsert,
): Promise<CaptionPresetRecord> {
  const ts = new Date();
  const id = nanoid();
  const done = log.dbCalled('createCaptionPreset', undefined, { name: input.name });
  const [row] = await getDb()
    .insert(captionPresets)
    .values({
      id,
      name: input.name,
      style: TextStyleSchema.parse(JSON.parse(input.style) as unknown),
      position: PositionSchema.parse(JSON.parse(input.position) as unknown),
      createdAt: ts,
      updatedAt: ts,
    })
    .returning();
  done({ created: 1 });
  return rowToRecord(row!);
}

export async function updateCaptionPreset(
  id: string,
  input: Partial<CaptionPresetInsert>,
): Promise<CaptionPresetRecord | null> {
  const ts = new Date();
  const done = log.dbCalled('updateCaptionPreset', undefined, { id });
  const updates: Partial<typeof captionPresets.$inferInsert> = { updatedAt: ts };
  if (input.name !== undefined) updates.name = input.name;
  if (input.style !== undefined) {
    updates.style = TextStyleSchema.parse(JSON.parse(input.style) as unknown);
  }
  if (input.position !== undefined) {
    updates.position = PositionSchema.parse(JSON.parse(input.position) as unknown);
  }
  const [row] = await getDb()
    .update(captionPresets)
    .set(updates)
    .where(eq(captionPresets.id, id))
    .returning();
  done({ updated: row ? 1 : 0 });
  return row ? rowToRecord(row) : null;
}

export async function deleteCaptionPreset(id: string): Promise<boolean> {
  const done = log.dbCalled('deleteCaptionPreset', undefined, { id });
  const rows = await getDb()
    .delete(captionPresets)
    .where(eq(captionPresets.id, id))
    .returning({ id: captionPresets.id });
  const deleted = rows.length > 0;
  done({ deleted: deleted ? 1 : 0 });
  return deleted;
}
