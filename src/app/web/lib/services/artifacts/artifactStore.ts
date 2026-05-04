import { promises as fs } from 'fs';
import { basename, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import type { ClipArtifact, ClipPlan } from '@app/web/types/analysis.js';

const WEB_OUTPUT_DIR = 'web';

function artifactRoot(outputDir: string, kind: 'analyses' | 'clips'): string {
  return resolve(outputDir, WEB_OUTPUT_DIR, kind);
}

async function ensureArtifactDir(outputDir: string, kind: 'analyses' | 'clips'): Promise<string> {
  const dir = artifactRoot(outputDir, kind);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function createArtifactId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export async function saveAnalysis(plan: ClipPlan, outputDir: string): Promise<ClipPlan> {
  const dir = await ensureArtifactDir(outputDir, 'analyses');
  await fs.writeFile(join(dir, `${plan.id}.json`), JSON.stringify(plan, null, 2), 'utf-8');
  return plan;
}

export async function listAnalyses(outputDir: string): Promise<ClipPlan[]> {
  const dir = await ensureArtifactDir(outputDir, 'analyses');
  const names = await fs.readdir(dir);
  const plans: ClipPlan[] = [];

  for (const name of names.filter((item) => item.endsWith('.json'))) {
    const raw = await fs.readFile(join(dir, name), 'utf-8');
    plans.push(JSON.parse(raw) as ClipPlan);
  }

  return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveClipArtifacts(
  artifacts: ClipArtifact[],
  outputDir: string,
): Promise<ClipArtifact[]> {
  const dir = await ensureArtifactDir(outputDir, 'clips');

  for (const artifact of artifacts) {
    await fs.writeFile(
      join(dir, `${artifact.id}.json`),
      JSON.stringify(artifact, null, 2),
      'utf-8',
    );
  }

  return artifacts;
}

export async function listClipArtifacts(outputDir: string): Promise<ClipArtifact[]> {
  const dir = await ensureArtifactDir(outputDir, 'clips');
  const names = await fs.readdir(dir);
  const artifacts: ClipArtifact[] = [];

  for (const name of names.filter((item) => item.endsWith('.json'))) {
    const raw = await fs.readFile(join(dir, name), 'utf-8');
    artifacts.push(JSON.parse(raw) as ClipArtifact);
  }

  return artifacts.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function toClipArtifactPath(path: string): string {
  return basename(path);
}
