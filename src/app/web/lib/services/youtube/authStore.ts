import { promises as fs } from 'fs';
import { join } from 'path';
import { getConfigDir } from '@lib/config/fileStore.js';
import { YouTubeAuthStateSchema, type YouTubeAuthState } from '@app/web/types/publish.js';

const YOUTUBE_AUTH_FILE_NAME = 'youtube-auth.json';

function getYouTubeAuthFilePath(): string {
  return join(getConfigDir(), YOUTUBE_AUTH_FILE_NAME);
}

export async function loadYouTubeAuthState(): Promise<YouTubeAuthState | null> {
  const filePath = getYouTubeAuthFilePath();

  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return YouTubeAuthStateSchema.parse(JSON.parse(raw));
  } catch (error) {
    if (isMissingFileError(error)) return null;
    throw error;
  }
}

export async function saveYouTubeAuthState(state: YouTubeAuthState): Promise<YouTubeAuthState> {
  const dir = getConfigDir();
  const filePath = getYouTubeAuthFilePath();
  const tmpPath = `${filePath}.tmp`;

  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(tmpPath, JSON.stringify(state, null, 2) + '\n', 'utf-8');
  await fs.rename(tmpPath, filePath);
  return state;
}

export async function clearYouTubeAuthState(): Promise<void> {
  const filePath = getYouTubeAuthFilePath();

  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (!isMissingFileError(error)) throw error;
  }
}

function isMissingFileError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: string }).code === 'ENOENT'
  );
}
