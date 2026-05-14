<script lang="ts">
  import type { PlaybackBarProps } from '@app/web/types/componentProps.js';
  import Icon from '@web/components/Icon.svelte';
  import Scrubber from '@web/components/Scrubber.svelte';
  import { formatTime } from '@web/lib/format.js';

  let { videoEl, currentTime, durationSec, isPlaying }: PlaybackBarProps = $props();

  function togglePlay(): void {
    if (!videoEl) return;
    if (videoEl.paused) void videoEl.play();
    else videoEl.pause();
  }

  function handleScrub(sec: number): void {
    if (videoEl) videoEl.currentTime = sec;
  }
</script>

<div class="ce-playback">
  <button
    type="button"
    class="ce-play-btn"
    onclick={togglePlay}
    aria-label={isPlaying ? 'Pause' : 'Play'}
  >
    <Icon name={isPlaying ? 'pause' : 'play'} size={12} />
  </button>
  <span class="ce-pb-time">
    <span class="now">{formatTime(currentTime)}</span> / {formatTime(durationSec)}
  </span>
  <Scrubber
    value={currentTime}
    max={durationSec}
    step={0.05}
    ariaLabel="Seek"
    onchange={handleScrub}
  />
</div>
