import { formatSeconds } from '@lib/utils/format.js';
import type { ClipPlan, ClipArtifact } from '@lib/types/analysis.js';

export function printTable(headers: string[], rows: string[][]): void {
  const widths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? '').length)));
  const sep = widths.map((w) => '-'.repeat(w)).join('  ');

  console.log(headers.map((h, i) => h.padEnd(widths[i])).join('  '));
  console.log(sep);
  for (const row of rows) {
    console.log(row.map((cell, i) => (cell ?? '').padEnd(widths[i])).join('  '));
  }
}

export function printAnalysisSummary(plan: ClipPlan): void {
  console.log('');
  console.log(`Analysis ID : ${plan.id}`);
  console.log(`Video       : ${plan.title} (${plan.videoId})`);
  console.log(
    `Duration    : ${plan.durationSec > 0 ? formatSeconds(plan.durationSec) : 'unknown'}`,
  );
  console.log(`Candidates  : ${plan.candidates.length}`);
  console.log(`Chunks      : ${plan.chunkEvaluations.length}`);
  console.log('');

  if (plan.candidates.length > 0) {
    printCandidates(plan);
  }

  console.log(`\nRun: video-clipper clip ${plan.id}`);
}

export function printCandidates(plan: ClipPlan): void {
  const headers = ['Rank', 'Score', 'Time Range', 'Source', 'Reason'];
  const rows = plan.candidates.map((c) => [
    String(c.rank),
    String(c.score),
    `${formatSeconds(c.startSec)}-${formatSeconds(c.endSec)}`,
    c.source,
    c.reason.length > 60 ? `${c.reason.slice(0, 57)}...` : c.reason,
  ]);
  printTable(headers, rows);
}

export function printClipResults(clips: ClipArtifact[]): void {
  if (clips.length === 0) {
    console.log('No clips were generated.');
    return;
  }

  console.log(`\n${clips.length} clip${clips.length !== 1 ? 's' : ''} generated:\n`);
  const headers = ['#', 'Duration', 'Path'];
  const rows = clips.map((c, i) => [String(i + 1), formatSeconds(c.durationSec), c.path]);
  printTable(headers, rows);
}

export function printAnalysesList(analyses: ClipPlan[]): void {
  if (analyses.length === 0) {
    console.log('No analyses found. Run: video-clipper analyze <youtube-url>');
    return;
  }

  const headers = ['ID', 'Video', 'Candidates', 'Created'];
  const rows = analyses.map((a) => [
    a.id,
    a.title.length > 40 ? `${a.title.slice(0, 37)}...` : a.title,
    String(a.candidates.length),
    a.createdAt.slice(0, 19).replace('T', ' '),
  ]);
  printTable(headers, rows);
}

export function printClipsList(clips: ClipArtifact[]): void {
  if (clips.length === 0) {
    console.log('No clips found.');
    return;
  }

  const headers = ['ID', 'Filename', 'Duration', 'Created'];
  const rows = clips.map((c) => [
    c.id,
    c.filename,
    formatSeconds(c.durationSec),
    c.createdAt.slice(0, 19).replace('T', ' '),
  ]);
  printTable(headers, rows);
}
