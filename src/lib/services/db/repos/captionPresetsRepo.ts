import { eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '../client.js';
import { captionPresets } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { CaptionPresetRecord, CaptionPresetInsert } from '@lib/types/db.js';

function rowToRecord(row: typeof captionPresets.$inferSelect): CaptionPresetRecord {
  return {
    id: row.id,
    name: row.name,
    style: row.style,
    position: row.position,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function listCaptionPresets(): CaptionPresetRecord[] {
  const done = log.dbCalled('listCaptionPresets', undefined, {});
  const rows = db.select().from(captionPresets).orderBy(captionPresets.createdAt).all();
  done({ found: rows.length });
  return rows.map(rowToRecord);
}

export function getCaptionPreset(id: string): CaptionPresetRecord | null {
  const done = log.dbCalled('getCaptionPreset', undefined, { id });
  const row = db.select().from(captionPresets).where(eq(captionPresets.id, id)).get();
  done({ found: row ? 1 : 0 });
  return row ? rowToRecord(row) : null;
}

export function createCaptionPreset(input: CaptionPresetInsert): CaptionPresetRecord {
  const ts = Date.now();
  const id = nanoid();
  const done = log.dbCalled('createCaptionPreset', undefined, { name: input.name });
  db.insert(captionPresets)
    .values({
      id,
      name: input.name,
      style: input.style,
      position: input.position,
      createdAt: ts,
      updatedAt: ts,
    })
    .run();
  done({ created: 1 });
  return getCaptionPreset(id)!;
}

export function updateCaptionPreset(
  id: string,
  input: Partial<CaptionPresetInsert>,
): CaptionPresetRecord | null {
  const ts = Date.now();
  const done = log.dbCalled('updateCaptionPreset', undefined, { id });
  const updates: Partial<typeof captionPresets.$inferInsert> = { updatedAt: ts };
  if (input.name !== undefined) updates.name = input.name;
  if (input.style !== undefined) updates.style = input.style;
  if (input.position !== undefined) updates.position = input.position;
  db.update(captionPresets).set(updates).where(eq(captionPresets.id, id)).run();
  done({ updated: 1 });
  return getCaptionPreset(id);
}

export function deleteCaptionPreset(id: string): boolean {
  const done = log.dbCalled('deleteCaptionPreset', undefined, { id });
  const result = db.delete(captionPresets).where(eq(captionPresets.id, id)).run();
  const deleted = (result.changes ?? 0) > 0;
  done({ deleted: deleted ? 1 : 0 });
  return deleted;
}
