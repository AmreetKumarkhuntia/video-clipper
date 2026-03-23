import { execa } from 'execa';
import { log } from './logger.js';

/**
 * Resolves the Python interpreter binary, caching the result after the first
 * successful lookup. Shared by both Python-based analyzers (Whisper, YAMNet)
 * and the Whisper transcript analyzer.
 */
let _pythonBin: string | null = null;

export async function getPythonBin(): Promise<string> {
  if (_pythonBin) return _pythonBin;

  for (const bin of ['python3', 'python']) {
    try {
      await execa(bin, ['--version']);
      _pythonBin = bin;
      return bin;
    } catch {
      log.warn(`${bin} not found, trying next binary...`);
    }
  }

  throw new Error(
    'No Python interpreter found (tried python3, python). Install Python 3 to use YAMNet or Whisper.',
  );
}
