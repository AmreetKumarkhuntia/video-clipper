# Video Store

`src/app/web/lib/stores/video.ts`

A session-level Svelte store that caches per-video backend data.
All pages that touch a video read from this store first and write
back to it after every fetch or mutation — avoiding redundant
network requests across page navigations.

---

## Data Shape

```
VideoStore = Record<videoId, VideoEntry>

VideoEntry
├── video:      VideoDetails | null
├── transcript: TranscriptBundle | null
└── analyses:   Record<analysisId, AnalysisEntry>
                ├── plan:  ClipPlan | null
                └── clips: ClipArtifact[]
```

Types are defined in `src/app/web/types/videoStore.ts`.

---

## API

### Store (reactive)

| Export       | Type                   | Description                                                                                                             |
| ------------ | ---------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `videoStore` | `Readable<VideoStore>` | Subscribe for reactive updates. The underlying writable is not exported — all mutations go through the functions below. |

### Video-level setters

| Function                             | Description                                     |
| ------------------------------------ | ----------------------------------------------- |
| `setVideo(videoId, video)`           | Write fetched `VideoDetails`                    |
| `setTranscript(videoId, transcript)` | Write fetched `TranscriptBundle`                |
| `clearTranscript(videoId)`           | Set `transcript` to `null` (after DELETE cache) |

### Analysis-level setters

| Function                                     | Description                                                     |
| -------------------------------------------- | --------------------------------------------------------------- |
| `setAnalysisPlan(videoId, analysisId, plan)` | Write a completed `ClipPlan` (after SSE stream or direct fetch) |
| `setClips(videoId, analysisId, clips)`       | Write generated `ClipArtifact[]`                                |
| `clearAnalysis(videoId)`                     | Remove all `analyses` entries for a video (after DELETE cache)  |

---

## Usage Pattern

### Reading (check store before fetching)

```ts
import { get } from 'svelte/store';
import { videoStore, setVideo } from '@web/lib/stores/video.js';

async function loadVideo(videoId: string): Promise<void> {
  const cached = get(videoStore)[videoId]?.video;
  if (cached) {
    video = cached;
    return;
  }

  isLoadingVideo = true;
  try {
    const result = await apiFetch<VideoDetails>(`/api/youtube/videos/${videoId}`);
    setVideo(videoId, result);
    video = result;
  } finally {
    isLoadingVideo = false;
  }
}
```

### Writing after mutation

```ts
// After generating clips
const data = await apiFetch<{ clips: ClipArtifact[] }>('/api/clips', { ... });
setClips(videoId, analysisId, data.clips);
clips = data.clips;
```

### Reactive subscription

```svelte
<script lang="ts">
  import { videoStore } from '@web/lib/stores/video.js';
</script>

<!-- Read reactively in template -->
{$videoStore[videoId]?.video?.title}
```

---

## Pages That Use This Store

| Page                                                          | Reads                                 | Writes                                                                             |
| ------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------- |
| `videos/[videoId]/+page.svelte`                               | `video`, `transcript`                 | `setVideo`, `setTranscript`, `setAnalysisPlan`, `clearTranscript`, `clearAnalysis` |
| `videos/[videoId]/analysis/[analysisId]/+page.svelte`         | `analyses[analysisId].plan`, `.clips` | `setAnalysisPlan`, `setClips`                                                      |
| `videos/[videoId]/analysis/[analysisId]/prepare/+page.svelte` | `video` (for AI metadata generation)  | —                                                                                  |

---

## What Is NOT In This Store

These remain as local `$state` in each page — they are ephemeral UI state
tightly coupled to a single page's lifecycle:

- Loading booleans (`isLoadingVideo`, `isLoadingTranscript`, `isAnalyzing`)
- Error strings (`errorMessage`)
- SSE streaming state (`streamingCandidates`, `activityState`, `analysisPhase`)
- `abortController`
- Publish/upload data (`PublishDraft`, `UploadArtifact`, `YouTubeAuthStatus`)
