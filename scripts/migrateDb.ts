import { getDatabaseConfig } from '@lib/config/index.js';
import { closeDb, initDb, runMigrations } from '@lib/services/db/index.js';

async function main(): Promise<void> {
  initDb(getDatabaseConfig());
  try {
    await runMigrations();
  } finally {
    await closeDb();
  }
}

try {
  await main();
} catch (error) {
  const reason = error instanceof Error ? error.message : String(error);
  console.error(`[error] Database migration failed: ${reason}`);
  process.exitCode = 1;
}
