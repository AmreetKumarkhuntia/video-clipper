import {
  DatabaseEnvironmentSchema,
  type DatabaseConfig,
  type DatabaseEnvironment,
} from '@lib/types/config.js';

/** Reads restart-only PostgreSQL settings directly from the process environment. */
export function getDatabaseConfig(env: NodeJS.ProcessEnv = process.env): DatabaseConfig {
  const parsed: DatabaseEnvironment = DatabaseEnvironmentSchema.parse(env);

  return {
    connectionString: parsed.DATABASE_URL,
    max: parsed.DATABASE_POOL_MAX,
    connectionTimeoutMillis: parsed.DATABASE_CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: parsed.DATABASE_IDLE_TIMEOUT_MS,
  };
}
