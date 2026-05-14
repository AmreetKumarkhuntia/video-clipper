export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;

  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatTime(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

export function formatTimecode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  const wholeSecs = Math.floor(secs);
  const millis = Math.round((secs - wholeSecs) * 1000);
  return `${String(mins).padStart(2, '0')}:${String(wholeSecs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
}

export function parseTimecode(input: string): number | null {
  const trimmed = input.trim();
  const match = trimmed.match(/^(\d{1,2}):(\d{1,2})(?:\.(\d{1,3}))?$/);
  if (!match) return null;
  const mins = Number(match[1]);
  const secs = Number(match[2]);
  const millis = match[3] ? Number(match[3].padEnd(3, '0').slice(0, 3)) : 0;
  if (secs >= 60) return null;
  return mins * 60 + secs + millis / 1000;
}
