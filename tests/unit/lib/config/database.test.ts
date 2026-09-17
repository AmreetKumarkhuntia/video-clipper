import { describe, expect, it } from 'vitest';
import { getDatabaseConfig } from '@lib/config/database.js';

describe('getDatabaseConfig', () => {
  it('requires a PostgreSQL URL and applies restart-only pool defaults', () => {
    expect(
      getDatabaseConfig({ DATABASE_URL: 'postgresql://db.example.test/video_clipper' }),
    ).toEqual({
      connectionString: 'postgresql://db.example.test/video_clipper',
      max: 10,
      connectionTimeoutMillis: 5_000,
      idleTimeoutMillis: 30_000,
    });
  });

  it('accepts explicit pool limits from the environment', () => {
    expect(
      getDatabaseConfig({
        DATABASE_URL: 'postgres://localhost/video_clipper',
        DATABASE_POOL_MAX: '23',
        DATABASE_CONNECTION_TIMEOUT_MS: '8000',
        DATABASE_IDLE_TIMEOUT_MS: '45000',
      }),
    ).toMatchObject({
      max: 23,
      connectionTimeoutMillis: 8_000,
      idleTimeoutMillis: 45_000,
    });
  });

  it.each([
    {},
    { DATABASE_URL: 'file:///tmp/database' },
    { DATABASE_URL: 'postgresql://localhost/video_clipper', DATABASE_POOL_MAX: '0' },
    {
      DATABASE_URL: 'postgresql://localhost/video_clipper',
      DATABASE_CONNECTION_TIMEOUT_MS: '0',
    },
  ])('rejects missing or invalid database settings %#', (environment) => {
    expect(() => getDatabaseConfig(environment)).toThrow();
  });
});
