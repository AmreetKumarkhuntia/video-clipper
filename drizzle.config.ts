import type { Config } from 'drizzle-kit';
import os from 'node:os';
import path from 'node:path';

export default {
  schema: './src/lib/services/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url:
      process.env.LIBRARY_DB_PATH ??
      path.join(os.homedir(), '.config', 'video-clipper', 'library.sqlite'),
  },
} satisfies Config;
