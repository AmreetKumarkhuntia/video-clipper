import { promises as fs } from 'fs';
import { basename, join, resolve } from 'path';
import { randomUUID } from 'crypto';
import { config } from '../../config/index.js';
import type { ClipArtifact, ClipPlan } from '../../types/index.js';

const WEB_OUTPUT_DIR = 'web';

function artifactRoot(kind: 'analyses' | 'clips'): string {
  return resolve(config.OUTPUT_DIR, WEB_OUTPUT_DIR, kind);
}

async function ensureArtifactDir(kind: 'analyses' | 'clips'): Promise<string> {
  const dir = artifactRoot(kind);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export function createArtifactId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}

export async function saveAnalysis(plan: ClipPlan): Promise<ClipPlan> {
  const dir = await ensureArtifactDir('analyses');
  await fs.writeFile(join(dir, `${plan.id}.json`), JSON.stringify(plan, null, 2), 'utf-8');
  return plan;
}

export async function listAnalyses(): Promise<ClipPlan[]> {
  const dir = await ensureArtifactDir('analyses');
  const names = await fs.readdir(dir);
  const plans: ClipPlan[] = [];

  for (const name of names.filter((item) => item.endsWith('.json'))) {
    const raw = await fs.readFile(join(dir, name), 'utf-8');
    plans.push(JSON.parse(raw) as ClipPlan);
  }

  return plans.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveClipArtifacts(artifacts: ClipArtifact[]): Promise<ClipArtifact[]> {
  const dir = await ensureArtifactDir('clips');

  for (const artifact of artifacts) {
    await fs.writeFile(
      join(dir, `${artifact.id}.json`),
      JSON.stringify(artifact, null, 2),
      'utf-8',
    );
  }

  return artifacts;
}

export async function listClipArtifacts(): Promise<ClipArtifact[]> {
  const dir = await ensureArtifactDir('clips');
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
