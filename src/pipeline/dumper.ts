import { promises as fs } from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import { log } from '../utils/logger.js';
import type { TranscriptLine, PipelineResult } from '../types/index.js';

/**
 * Writes the raw normalized transcript lines to
 * `{OUTPUT_DIR}/transcript/{videoId}.json`.
 */
export async function dumpTranscript(videoId: string, lines: TranscriptLine[]): Promise<void> {
  try {
    const dir = path.join(config.OUTPUT_DIR, 'transcript');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${videoId}.json`);
    await fs.writeFile(filePath, JSON.stringify(lines, null, 2), 'utf-8');
    log.info(`Transcript dumped to ${filePath}`);
  } catch (err) {
    log.warn(
      `Failed to dump transcript for ${videoId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}

/**
 * Writes the full pipeline result (metadata + ranked segments) to
 * `{OUTPUT_DIR}/analysis/{videoId}.json`.
 */
export async function dumpAnalysis(videoId: string, result: PipelineResult): Promise<void> {
  try {
    const dir = path.join(config.OUTPUT_DIR, 'analysis');
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, `${videoId}.json`);
    await fs.writeFile(filePath, JSON.stringify(result, null, 2), 'utf-8');
    log.info(`Analysis dumped to ${filePath}`);
  } catch (err) {
    log.warn(
      `Failed to dump analysis for ${videoId}: ${err instanceof Error ? err.message : String(err)}`,
    );
  }
}
