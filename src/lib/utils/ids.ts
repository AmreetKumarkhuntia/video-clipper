import { randomUUID } from 'crypto';

/**
 * Generates a unique, sortable artifact id: `<prefix>-<timestamp>-<random>`.
 *
 * Used for analyses, publish drafts, and upload artifacts.
 */
export function createArtifactId(prefix: string): string {
  return `${prefix}-${Date.now()}-${randomUUID().slice(0, 8)}`;
}
