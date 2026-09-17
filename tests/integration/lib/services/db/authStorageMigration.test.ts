import { afterEach, describe, expect, it } from 'vitest';
import {
  assertMigrationsCurrent,
  createCustomer,
  withDbTransaction,
} from '@lib/services/db/index.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../support/postgres.js';
import { seedAnalysis, seedCustomer, seedSegmentation } from './postgresFixtures.js';

let database: PostgresTestDatabase | undefined;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

afterEach(async () => {
  if (!database) return;
  await database.close();
  database = undefined;
});

describe('PostgreSQL baseline migration', () => {
  it('migrates an empty schema, seeds roles, and installs native PostgreSQL types and indexes', async () => {
    database = await createPostgresTestDatabase('empty_baseline', false);
    const options = { migrationsSchema: database.migrationSchemaName };

    await expect(assertMigrationsCurrent(undefined, options)).rejects.toThrow(
      /run `pnpm db:migrate`/i,
    );
    const before = await database.query<{ relation: string | null }>(
      "select to_regclass(current_schema() || '.roles')::text as relation",
    );
    expect(before.rows[0]?.relation).toBeNull();

    await database.migrate();
    await expect(assertMigrationsCurrent(undefined, options)).resolves.toBeUndefined();

    const roles = await database.query<{
      id: string;
      permissions: unknown;
      timestamps_match: boolean;
    }>(
      `select id, permissions, updated_at = created_at as timestamps_match
       from roles
       order by rank`,
    );
    expect(roles.rows).toEqual([
      { id: 'customer', permissions: [], timestamps_match: true },
      { id: 'admin', permissions: ['settings:write'], timestamps_match: true },
    ]);

    const columns = await database.query<{ column_name: string; data_type: string }>(
      `select column_name, data_type
       from information_schema.columns
       where table_schema = current_schema()
         and (table_name, column_name) in (
           ('videos', 'published_at'),
           ('videos', 'tags'),
           ('segmentations', 'completed'),
           ('segmentations', 'score'),
           ('segmentations', 'rank')
         )
       order by column_name`,
    );
    expect(columns.rows).toEqual([
      { column_name: 'completed', data_type: 'boolean' },
      { column_name: 'published_at', data_type: 'timestamp with time zone' },
      { column_name: 'rank', data_type: 'integer' },
      { column_name: 'score', data_type: 'double precision' },
      { column_name: 'tags', data_type: 'jsonb' },
    ]);

    const indexes = await database.query<{ indexname: string; indexdef: string }>(
      'select indexname, indexdef from pg_indexes where schemaname = current_schema()',
    );
    expect(indexes.rows.map((row) => row.indexname)).toEqual(
      expect.arrayContaining([
        'chunks_video_range_idx',
        'segmentations_cache_idx',
        'analyses_video_created_idx',
        'clips_analysis_id_idx',
        'clips_video_id_idx',
        'sessions_expires_at_idx',
        'qa_messages_video_created_idx',
        'auth_identities_provider_channel_uq',
      ]),
    );
    expect(
      indexes.rows.find((row) => row.indexname === 'auth_identities_provider_channel_uq')?.indexdef,
    ).toMatch(/where .*channel_id.* is not null/i);
  });

  it('reruns idempotently without overwriting stored roles or assignments', async () => {
    database = await createPostgresTestDatabase('idempotent_baseline');
    await database.query("update roles set permissions = '[]'::jsonb where id = 'admin'");
    await database.query(
      `insert into roles (id, rank, permissions, created_at, updated_at)
       values ('custom-role', 50, '["settings:write"]'::jsonb, now(), now())`,
    );
    await database.query(
      `insert into customers (id, role_id, created_at, updated_at)
       values ('custom-customer', 'custom-role', now(), now())`,
    );
    const ledgerTable = `${quoteIdentifier(database.migrationSchemaName)}.${quoteIdentifier('__drizzle_migrations')}`;
    const ledgerBefore = await database.query<{ count: number }>(
      `select count(*)::int as count from ${ledgerTable}`,
    );

    await database.migrate();

    const ledgerAfter = await database.query<{ count: number }>(
      `select count(*)::int as count from ${ledgerTable}`,
    );
    expect(ledgerAfter.rows).toEqual(ledgerBefore.rows);
    const stored = await database.query<{ role_id: string; permissions: unknown }>(
      `select customers.role_id, roles.permissions
       from customers
       join roles on roles.id = customers.role_id
       where customers.id = 'custom-customer'`,
    );
    expect(stored.rows).toEqual([{ role_id: 'custom-role', permissions: ['settings:write'] }]);
    const admin = await database.query<{ permissions: unknown }>(
      "select permissions from roles where id = 'admin'",
    );
    expect(admin.rows[0]?.permissions).toEqual([]);
  });

  it('persists rows after the application pool closes and reopens', async () => {
    database = await createPostgresTestDatabase('pool_reopen');
    await seedCustomer(database, 'persistent-customer');

    await database.reopen();

    const persisted = await database.query<{ id: string }>(
      'select id from customers where id = $1',
      ['persistent-customer'],
    );
    expect(persisted.rows).toEqual([{ id: 'persistent-customer' }]);
  });

  it('rolls back every write when a transaction operation rejects', async () => {
    database = await createPostgresTestDatabase('transaction_rollback');

    await expect(
      withDbTransaction(async () => {
        await createCustomer({ email: 'rollback@example.com' });
        throw new Error('force rollback');
      }),
    ).rejects.toThrow('force rollback');

    const count = await database.query<{ count: number }>(
      'select count(*)::int as count from customers where email = $1',
      ['rollback@example.com'],
    );
    expect(count.rows[0]?.count).toBe(0);
  });

  it('keeps upload artifact ids as audit references without a clip foreign key', async () => {
    database = await createPostgresTestDatabase('upload_audit_reference');
    await seedAnalysis(database, 'analysis-1', 'video-1');
    await seedSegmentation(database, 'segment-1', 'video-1');
    const timestamp = new Date('2026-01-01T00:00:00.000Z');
    await database.query(
      `insert into clips
         (id, video_id, analysis_id, segmentation_id, segment_rank, filename, path,
          start_sec, end_sec, duration_sec, created_at, updated_at)
       values ('clip-1', 'video-1', 'analysis-1', 'segment-1', 1, 'clip.mp4', '/clip.mp4',
               10, 40, 30, $1, $1)`,
      [timestamp],
    );
    await database.query(
      `insert into upload_artifacts
         (id, analysis_id, video_id, clip_artifact_id, title, privacy_status, status,
          created_at, updated_at)
       values ('upload-1', 'analysis-1', 'video-1', 'clip-1', 'Upload', 'private', 'complete',
               $1, $1)`,
      [timestamp],
    );

    await database.query("delete from clips where id = 'clip-1'");
    const afterClipDelete = await database.query<{ clip_artifact_id: string }>(
      "select clip_artifact_id from upload_artifacts where id = 'upload-1'",
    );
    expect(afterClipDelete.rows).toEqual([{ clip_artifact_id: 'clip-1' }]);

    await database.query("delete from videos where id = 'video-1'");
    const afterVideoDelete = await database.query<{ count: number }>(
      "select count(*)::int as count from upload_artifacts where id = 'upload-1'",
    );
    expect(afterVideoDelete.rows[0]?.count).toBe(0);
  });
});
