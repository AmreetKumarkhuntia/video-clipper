# Remove File-Based Clip Artifacts; Persist Clips in SQLite

> **Status: TODO** — no code written yet. Companion to [remove-analysis-file-cache.md](./remove-analysis-file-cache.md), same pattern, scoped to the clip layer.

## Context (why)

Today the analysis page (`/videos/[id]/analysis/[analysisId]`) renders clips read from JSON sidecars in `outputs/web/clips/<clipId>.json` and `outputs/web/clip-edits/<clipId>.json`. The actual MP4s also live under `outputs/web/clips/` (and stay there — only their _metadata_ is moving). With SQLite now the source of truth for videos, chunks, and segmentations, those JSON sidecars are the last file-based source of structured state in the web app and they cause:

- Two parallel "stores" for clip rows (DB has the segment, disk has the clip pointing at it).
- Listings (`listClipArtifactsByAnalysisId`) require reading every JSON file in the dir.
- No referential integrity between a clip and the segment it was cut from.
- Awkward update paths (`updateClipArtifactPaths` is read-modify-write JSON).

**Goal:** introduce a `clips` table that owns clip metadata + edits JSON + render-path bookkeeping. MP4 files keep living in `outputs/web/clips/`; everything else moves to the DB.

## Decisions already made with the user

- **Data model: new `clips` table**, FK to `segmentations.id` (nullable), not extra columns on `segmentations`. Reason: `upsertSegmentations` does delete-then-insert on re-runs, which would wipe clips. A separate table survives re-segmentation. Linked via `segmentationId` (nullable so an orphaned clip after re-segmentation is still queryable) plus `segmentRank` (denorm so we can match a clip to a fresh segmentation row by rank when needed).
- **No migration of existing JSON sidecars.** Start fresh. Old `outputs/web/clips/*.json` and `outputs/web/clip-edits/*.json` become orphaned and can be deleted manually. Old `.mp4`s on disk are orphaned too (the user can clean `outputs/web/clips/` or re-export the clips they care about).
- **`editsJson` lives on the clip row** as TEXT (JSON of `ClipEdits` minus `clipId` since that's redundant with the row id). `clipEditsPath` and the `clip-edits/` directory go away entirely.
- **MP4 files stay on disk** at `outputs/web/clips/<clipId>.mp4` and `<clipId>_edited.mp4`. Only the _paths_ (and the edits payload) move to DB. The file endpoint still streams from disk.
- **`analysisId` is kept on the clip row** even though we have `segmentationId` — the analysis-page loader filters by it, and segmentations don't currently carry the analysisId. Cheap denorm.

---

## Plan

### Step 1: Add `clips` table to Drizzle schema

File: `src/lib/services/db/schema.ts`

Append (after `segmentations`):

```typescript
// One row per generated clip. MP4 files still live on disk under outputs/web/clips/;
// this table is the source of truth for clip metadata, edits payload, and render-path bookkeeping.
// segmentationId is nullable so a clip remains queryable after its source segmentation row is
// replaced (segmentations get delete-then-inserted on re-runs). segmentRank is denormalised for
// matching back to a fresh segmentation row by (videoId, rank).
export const clips = sqliteTable('clips', {
  id: text('id').primaryKey(), // matches the existing clip artifact id, e.g. `clip-<videoId>-<segmentId>`
  videoId: text('video_id').notNull(),
  analysisId: text('analysis_id'), // denorm from generation request; null if generated outside an analysis flow
  segmentationId: text('segmentation_id'), // FK to segmentations.id, nullable on re-segmentation
  segmentRank: integer('segment_rank').notNull(),
  filename: text('filename').notNull(),
  path: text('path').notNull(), // absolute path to source mp4 on disk
  editedPath: text('edited_path'), // absolute path to rendered _edited.mp4 if present
  editsJson: text('edits_json'), // JSON of ClipEdits (clipId stripped — equal to row id); null until first save
  currentEditsHash: text('current_edits_hash'),
  lastRenderedHash: text('last_rendered_hash'),
  startSec: real('start_sec').notNull(),
  endSec: real('end_sec').notNull(),
  durationSec: real('duration_sec').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
```

Generate the migration:

```bash
pnpm exec drizzle-kit generate
```

This produces `drizzle/0003_*.sql` adding the `clips` table. Inspect the file before committing.

> The migrate skill is at `.claude/skills/migrate-endpoint-to-sqlite.md` — follow it if anything looks off (e.g. column types). Drizzle runs migrations at boot via `src/lib/services/db/migrate.ts`.

### Step 2: Add a `clipsRepo`

File: `src/lib/services/db/repos/clipsRepo.ts` (new)

API mirrors the existing artifactStore exports the rest of the code uses:

```typescript
import { eq, and } from 'drizzle-orm';
import { db } from '../client.js';
import { clips } from '../schema.js';
import { log } from '@lib/utils/logger.js';
import type { ClipArtifact } from '@app/web/types/analysis.js';
import type { ClipEdits } from '@lib/types/clipEdit.js';

function rowToArtifact(row: typeof clips.$inferSelect): ClipArtifact {
  return {
    id: row.id,
    videoId: row.videoId,
    ...(row.analysisId ? { analysisId: row.analysisId } : {}),
    segmentId: row.id.replace(`clip-${row.videoId}-`, ''), // keep wire shape stable
    filename: row.filename,
    path: row.path,
    startSec: row.startSec,
    endSec: row.endSec,
    durationSec: row.durationSec,
    createdAt: new Date(row.createdAt).toISOString(),
    ...(row.editedPath ? { editedPath: row.editedPath } : {}),
    ...(row.editsJson ? { editsPath: 'db' } : {}), // sentinel kept so existing UI checks (`editsPath != null`) keep working; consider removing in Step 7
    ...(row.currentEditsHash ? { currentEditsHash: row.currentEditsHash } : {}),
    ...(row.lastRenderedHash ? { lastRenderedHash: row.lastRenderedHash } : {}),
  };
}

export function getClipRow(clipId: string): typeof clips.$inferSelect | undefined {
  const done = log.dbCalled('getClipRow', undefined, { clipId });
  const row = db.select().from(clips).where(eq(clips.id, clipId)).get();
  done({ found: row ? 1 : 0 });
  return row;
}

export function getClip(clipId: string): ClipArtifact | null {
  const row = getClipRow(clipId);
  return row ? rowToArtifact(row) : null;
}

export function listClips(): ClipArtifact[] {
  const rows = db.select().from(clips).all();
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listClipsByAnalysisId(analysisId: string): ClipArtifact[] {
  const rows = db.select().from(clips).where(eq(clips.analysisId, analysisId)).all();
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function listClipsByVideoId(videoId: string): ClipArtifact[] {
  const rows = db.select().from(clips).where(eq(clips.videoId, videoId)).all();
  return rows.map(rowToArtifact).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface UpsertClipInput {
  id: string;
  videoId: string;
  analysisId?: string;
  segmentationId?: string;
  segmentRank: number;
  filename: string;
  path: string;
  startSec: number;
  endSec: number;
  durationSec: number;
}

/** Insert or update a freshly-generated clip. Preserves edits/render fields if a row already exists. */
export function upsertClip(input: UpsertClipInput): ClipArtifact {
  const ts = Date.now();
  const existing = getClipRow(input.id);
  db.insert(clips)
    .values({
      id: input.id,
      videoId: input.videoId,
      analysisId: input.analysisId ?? null,
      segmentationId: input.segmentationId ?? null,
      segmentRank: input.segmentRank,
      filename: input.filename,
      path: input.path,
      editedPath: existing?.editedPath ?? null,
      editsJson: existing?.editsJson ?? null,
      currentEditsHash: existing?.currentEditsHash ?? null,
      lastRenderedHash: existing?.lastRenderedHash ?? null,
      startSec: input.startSec,
      endSec: input.endSec,
      durationSec: input.durationSec,
      createdAt: existing?.createdAt ?? ts,
      updatedAt: ts,
    })
    .onConflictDoUpdate({
      target: clips.id,
      set: {
        videoId: input.videoId,
        analysisId: input.analysisId ?? null,
        segmentationId: input.segmentationId ?? null,
        segmentRank: input.segmentRank,
        filename: input.filename,
        path: input.path,
        startSec: input.startSec,
        endSec: input.endSec,
        durationSec: input.durationSec,
        updatedAt: ts,
      },
    })
    .run();
  return getClip(input.id)!;
}

export function setClipEdits(clipId: string, editsJson: string, currentEditsHash: string): void {
  db.update(clips)
    .set({ editsJson, currentEditsHash, updatedAt: Date.now() })
    .where(eq(clips.id, clipId))
    .run();
}

export function setClipRender(clipId: string, editedPath: string, lastRenderedHash: string): void {
  db.update(clips)
    .set({ editedPath, lastRenderedHash, updatedAt: Date.now() })
    .where(eq(clips.id, clipId))
    .run();
}

export function deleteClip(clipId: string): boolean {
  const result = db.delete(clips).where(eq(clips.id, clipId)).run();
  return (result.changes ?? 0) > 0;
}

export function deleteClipsByAnalysisId(analysisId: string, keepIds: string[] = []): number {
  // Used by generateWebClips to prune stale clips after a re-run for the same analysisId.
  const rows = db
    .select({ id: clips.id })
    .from(clips)
    .where(eq(clips.analysisId, analysisId))
    .all();
  const keep = new Set(keepIds);
  const toDelete = rows.map((r) => r.id).filter((id) => !keep.has(id));
  for (const id of toDelete) db.delete(clips).where(eq(clips.id, id)).run();
  return toDelete.length;
}
```

Notes:

- The `segmentId` in the wire shape is derived from the row id (`clip-<videoId>-<segmentId>`) to keep the existing `ClipArtifact` shape unchanged for the frontend. The frontend reads `clip.segmentId`; no UI change needed.
- The `editsPath: 'db'` sentinel keeps the `clip.editsPath ?? null` checks in `+page.svelte` and `ClipEditor.svelte` truthy. **TODO (Step 7):** prefer reshaping `ClipArtifact` to drop `editsPath` entirely and replace UI checks with `hasEdits: boolean`, but do that in a follow-up so this step doesn't fan out.

### Step 3: Rewrite `clipService.generateWebClips` to write to DB

File: `src/app/web/lib/services/clipping/clipService.ts`

Replace the `saveClipArtifacts` / `listClipArtifactsByAnalysisId` / `deleteClipArtifact` / `deleteClipEdits` calls with the new repo:

- Drop imports from `artifactStore` (`saveClipArtifacts`, `listClipArtifactsByAnalysisId`, `deleteClipArtifact`, `deleteClipEdits`).
- Import `upsertClip`, `listClipsByAnalysisId`, `deleteClipsByAnalysisId` from `@lib/services/db/repos/clipsRepo.js`.
- After `exportClips` returns paths, for each clip call `upsertClip({...})`. The `prior?.editedPath`/`editsPath`/hash fields are now preserved inside `upsertClip` automatically (it reads existing row first), so the spread of `prior` properties in the artifact construction can be deleted.
- Replace the stale-clip cleanup at the bottom with `deleteClipsByAnalysisId(input.analysisId, keepIds)` — but also `unlink` the orphaned `.mp4` / `_edited.mp4` files on disk before deletion (the old code only deleted JSON; now we should explicitly clean disk too, since the JSON sidecar is gone).
- The function still returns `ClipArtifact[]` (now via `upsertClip` → `getClip`).

The wire-side caller `POST /api/clips` is unchanged.

> **Important:** when generating clips, look up the matching `segmentations` row by `(videoId, rank)` against the latest completed batch and pass its id as `segmentationId`. This is the FK we want. Use `findSegmentations(videoId, optionsHash)` if optionsHash is available; otherwise query directly: `db.select().from(segmentations).where(and(eq(videoId, ...), eq(rank, ...), eq(completed, 1))).orderBy(desc(updatedAt)).get()`. If no row matches (analysis already invalidated), leave `segmentationId` undefined — the clip survives as orphan.

### Step 4: Rewrite `clipEditService` to use DB

File: `src/app/web/lib/services/clipping/clipEditService.ts`

- Delete `clipEditsPath` helper.
- Delete the `fs` and `path` imports for the edits dir.
- `loadClipEdits(clipId)` (drop `outputDir` arg):
  1. `const row = getClipRow(clipId)`; if null → throw "Clip not found".
  2. If `row.editsJson` → `ClipEditsSchema.parse({ ...JSON.parse(row.editsJson), clipId })`.
  3. Else → return defaults built from the row's `durationSec` (same shape as today).
- `saveClipEdits(edits)` (drop `outputDir` arg):
  1. `const parsed = ClipEditsSchema.parse({ ...edits, updatedAt: new Date().toISOString() })`.
  2. `const stable = { ...parsed }; delete stable.clipId;` (clipId is redundant with row id).
  3. `setClipEdits(parsed.clipId, JSON.stringify(stable), computeEditsHash(parsed))`.
  4. Return `parsed`.
- `renderEditedClip(cfg, clipId)` (drop `outputDir` arg):
  1. Load `getClip(clipId)` + `loadClipEdits(clipId)`.
  2. Compute `editedPath = artifact.path.replace(/\.mp4$/i, '_edited.mp4')` (unchanged).
  3. `renderClipWithEdits(...)` (unchanged).
  4. `setClipRender(clipId, editedPath, computeEditsHash(edits))`.
  5. Return updated `getClip(clipId)!`.

Update callers in the endpoints to drop the `outputDir` argument (Step 5).

### Step 5: Update clip endpoints to use the repo

File: `src/app/web/routes/api/clips/[clipId]/edits/+server.ts`

- Import `loadClipEdits`/`saveClipEdits` (already from `clipEditService` — signatures change in Step 4).
- Drop the `locals.config.OUTPUT_DIR` arg from both calls.

File: `src/app/web/routes/api/clips/[clipId]/render/+server.ts`

- Drop the `outputDir` arg from `renderEditedClip` (keep `cfg`).

File: `src/app/web/routes/api/clips/[clipId]/file/+server.ts`

- Replace `getClipArtifact(locals.config.OUTPUT_DIR, parsed.data.clipId)` with `getClip(parsed.data.clipId)` from the repo.
- Otherwise unchanged — still streams `filePath` from disk.

File: `src/app/web/routes/api/library/clips/+server.ts`

- Replace `listClipArtifacts` / `listClipArtifactsByAnalysisId` with `listClips` / `listClipsByAnalysisId` from the repo.
- These are now sync DB calls — drop the `await` if you want, but leaving it is harmless and keeps the diff small.

File: `src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+layout.server.ts`

- Replace `listClipArtifactsByAnalysisId(locals.config.OUTPUT_DIR, analysisId)` with `listClipsByAnalysisId(analysisId)`.
- Keep `getAnalysis` for now — it still reads `outputs/web/analyses/<id>.json`; analyses are out of scope for this plan (separate file-cache cleanup deferred).

File: `src/app/web/routes/api/clips/[clipId]/subtitles/plan/+server.ts`

- Read it; it likely doesn't touch clip artifacts (just operates on the clipId param). If it loads the clip, switch to `getClip`. Verify before editing.

File: `src/app/web/lib/services/publishing/draftService.ts`

- Replace `listClipArtifactsByAnalysisId(cfg.OUTPUT_DIR, analysisId)` with `listClipsByAnalysisId(analysisId)`.
- The `ClipArtifact` type passed into `buildDraftItem` is unchanged.

### Step 6: Remove clip code from `artifactStore.ts`

File: `src/app/web/lib/services/artifacts/artifactStore.ts`

Delete (and any now-unused imports):

- `getClipArtifact`
- `updateClipArtifactPaths`
- `saveClipArtifacts`
- `deleteClipArtifact`
- `deleteClipEdits`
- `listClipArtifacts`
- `listClipArtifactsByAnalysisId`
- The `'clips' | 'clip-edits'` literals in `artifactRoot` / `ensureArtifactDir` union types — narrow to `'analyses' | 'publish-drafts' | 'uploads'`.

Keep: `saveAnalysis`, `getAnalysis`, `listAnalyses`, `savePublishDraft`, `getPublishDraft`, `saveUploadArtifacts`, `listUploadArtifactsByAnalysisId`, `createArtifactId`, `isMissingFileError`.

### Step 7: Reshape `ClipArtifact` (optional, recommended in a follow-up)

File: `src/app/web/types/analysis.ts`

After Step 6, the only remaining purpose of `editsPath: string | undefined` in `ClipArtifactSchema` is to flag "edits exist." Replace with a cleaner `hasEdits: boolean` (default false) and update the two UI sites that check `clip.editsPath`:

- `src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+page.svelte`
- `src/app/web/widgets/video/clip-editor/ClipEditor.svelte`

This avoids the `editsPath: 'db'` sentinel in Step 2's `rowToArtifact` and keeps the API honest. Can ship in a separate PR if it bloats this one.

### Step 8: Tests

Tests in `tests/clipExporter/` and `tests/clipEditor/` — read them and update:

1. Replace any `getClipArtifact` / `saveClipArtifacts` / `loadClipEdits` / `saveClipEdits` mocks with the new repo functions. Easiest pattern: tests that hit disk should switch to an in-memory SQLite DB (the existing `videosRepo` / `chunksRepo` tests likely already do this — copy that setup).
2. Drop any assertions about files written under `outputs/web/clips/*.json` or `outputs/web/clip-edits/*.json`.
3. Keep assertions about `.mp4` files on disk (those still get written).

### Step 9: Verify

```bash
pnpm exec drizzle-kit generate  # if not already done
pnpm run web:check
pnpm run check
pnpm test
```

Manual smoke test:

1. `pnpm run web` → open a video → run analysis → click "Generate clips" → verify the analysis page lists the clips (data now comes from `clips` table).
2. Open a clip in the editor → trim/add subtitles → save → reload the page → edits persist (now from `clips.editsJson`).
3. Click "Render" → confirm `_edited.mp4` lands in `outputs/web/clips/` and the edited variant plays via `/api/clips/[id]/file?variant=edited`.
4. Re-run "Generate clips" for the same analysis with a different segment subset → orphaned clip rows are removed and their `.mp4`s unlinked from disk.
5. Inspect the DB: `sqlite3 <db-path> "select id, video_id, analysis_id, segmentation_id, segment_rank, path, edited_path, current_edits_hash, last_rendered_hash from clips;"` — expected: one row per generated clip.
6. Confirm no new files appear under `outputs/web/clips/*.json` or `outputs/web/clip-edits/`.

---

## Critical files (quick reference)

| Concern                 | Path                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| DB schema (add `clips`) | `src/lib/services/db/schema.ts`                                                                                          |
| New repo                | `src/lib/services/db/repos/clipsRepo.ts` (new)                                                                           |
| Clip generation         | `src/app/web/lib/services/clipping/clipService.ts`                                                                       |
| Clip edits + render     | `src/app/web/lib/services/clipping/clipEditService.ts`                                                                   |
| Artifact store (trim)   | `src/app/web/lib/services/artifacts/artifactStore.ts`                                                                    |
| Endpoints               | `src/app/web/routes/api/clips/+server.ts`, `.../[clipId]/{edits,render,file}/+server.ts`, `.../library/clips/+server.ts` |
| Analysis page loader    | `src/app/web/routes/videos/[videoId]/analysis/[analysisId]/+layout.server.ts`                                            |
| Publishing              | `src/app/web/lib/services/publishing/draftService.ts`                                                                    |
| Type (optional reshape) | `src/app/web/types/analysis.ts` + `+page.svelte` + `ClipEditor.svelte` (Step 7)                                          |
| Tests                   | `tests/clipExporter/...`, `tests/clipEditor/...`                                                                         |

## Out of scope

- Analyses (`outputs/web/analyses/<id>.json`) — separate cleanup.
- Publish drafts (`outputs/web/publish-drafts/`) — separate cleanup.
- Uploads (`outputs/web/uploads/`) — separate cleanup.
- Subtitles plan endpoint, beyond verifying it doesn't read clip JSON.
- CLI — the clip pipeline stage `exportClips` is reused by the CLI runner but does not write the JSON sidecars (those are web-only via `clipService`), so the CLI is unaffected.
