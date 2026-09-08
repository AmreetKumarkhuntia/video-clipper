import { vi } from 'vitest';

/**
 * Runs before every test file, so the suite behaves the same on a fresh clone,
 * in CI, and on a developer machine with a real `.env` and user config.
 *
 * The config module validates at import time and exits the process on a
 * missing provider key, so seed one where nothing is set. `??=` keeps a real
 * `.env` in charge locally: dotenv never overrides an existing variable.
 */
process.env.LLM_PROVIDER ??= 'openai';
process.env.OPENAI_API_KEY ??= 'test-openai-key';

/**
 * Never read the developer's ~/.config/video-clipper/config.json from a test —
 * its LLM_PROVIDER would override the seed above and demand a key the test
 * environment does not have. A test file that mocks this module itself still
 * wins, because its own `vi.mock` is registered after this one.
 */
vi.mock('../src/lib/config/fileStore.js', () => ({
  getConfigDir: (): string => '/nonexistent/video-clipper-test',
  getConfigFilePath: (): string => '/nonexistent/video-clipper-test/config.json',
  loadUserConfig: (): null => null,
  saveUserConfig: (): void => {},
}));
