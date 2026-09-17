import { randomUUID } from 'node:crypto';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';
import type { DatabaseConfig } from '@lib/types/config.js';
import { closeDb, initDb, pingDb, runMigrations } from '@lib/services/db/index.js';

const DEFAULT_POOL_CONFIG = {
  max: 4,
  connectionTimeoutMillis: 5_000,
  idleTimeoutMillis: 1_000,
} as const;

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

function requireTestDatabaseUrl(): string {
  const value = process.env.TEST_DATABASE_URL;
  if (!value) {
    throw new Error('TEST_DATABASE_URL is required for PostgreSQL integration and E2E tests.');
  }

  const url = new URL(value);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) {
    throw new Error('TEST_DATABASE_URL must use the postgres: or postgresql: protocol.');
  }

  const databaseName = decodeURIComponent(url.pathname.slice(1)).toLowerCase();
  if (!/(^|[-_])tests?($|[-_])/.test(databaseName)) {
    throw new Error(
      `Refusing PostgreSQL test setup for database "${databaseName}"; its name must contain a test marker.`,
    );
  }

  return value;
}

function privateSchemaName(label: string): string {
  const safeLabel = label
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/g, '_')
    .slice(0, 24);
  const worker = (process.env.VITEST_POOL_ID ?? process.pid.toString()).replaceAll(
    /[^a-zA-Z0-9]/g,
    '',
  );
  return `vc_${safeLabel}_${worker}_${randomUUID().replaceAll('-', '').slice(0, 10)}`.slice(0, 63);
}

function withSearchPath(connectionString: string, schemaName: string): string {
  const url = new URL(connectionString);
  url.searchParams.set('options', `-c search_path=${schemaName},public`);
  return url.toString();
}

export class PostgresTestDatabase {
  public readonly schemaName: string;
  public readonly migrationSchemaName: string;
  public readonly connectionString: string;

  readonly #administrationPool: Pool;
  readonly #inspectionPool: Pool;
  readonly #config: DatabaseConfig;
  #closed = false;

  private constructor(
    schemaName: string,
    migrationSchemaName: string,
    connectionString: string,
    administrationPool: Pool,
  ) {
    this.schemaName = schemaName;
    this.migrationSchemaName = migrationSchemaName;
    this.connectionString = connectionString;
    this.#administrationPool = administrationPool;
    this.#inspectionPool = new Pool({ connectionString, max: 2 });
    this.#config = { connectionString, ...DEFAULT_POOL_CONFIG };
  }

  public static async create(label: string, migrate = true): Promise<PostgresTestDatabase> {
    const baseUrl = requireTestDatabaseUrl();
    const schemaName = privateSchemaName(label);
    const migrationSchemaName = `${schemaName.slice(0, 54)}_drizzle`;
    const administrationPool = new Pool({ connectionString: baseUrl, max: 1 });
    let database: PostgresTestDatabase | undefined;

    try {
      await administrationPool.query(`create schema ${quoteIdentifier(schemaName)}`);
      await administrationPool.query(`create schema ${quoteIdentifier(migrationSchemaName)}`);
      database = new PostgresTestDatabase(
        schemaName,
        migrationSchemaName,
        withSearchPath(baseUrl, schemaName),
        administrationPool,
      );
      await database.open();
      if (migrate) await database.migrate();
      return database;
    } catch (error) {
      try {
        if (database) {
          await database.close();
        } else {
          await administrationPool.query(
            `drop schema if exists ${quoteIdentifier(migrationSchemaName)} cascade`,
          );
          await administrationPool.query(
            `drop schema if exists ${quoteIdentifier(schemaName)} cascade`,
          );
          await administrationPool.end();
        }
      } catch (cleanupError) {
        throw new AggregateError(
          [error, cleanupError],
          'PostgreSQL test database setup and cleanup both failed.',
        );
      }
      throw error;
    }
  }

  public async open(): Promise<void> {
    if (this.#closed) throw new Error('Cannot reopen a disposed PostgreSQL test database.');
    initDb(this.#config);
    await pingDb();
  }

  public async reopen(): Promise<void> {
    await closeDb();
    await this.open();
  }

  public async migrate(): Promise<void> {
    await runMigrations(undefined, { migrationsSchema: this.migrationSchemaName });
  }

  public async reset(): Promise<void> {
    const result = await this.#administrationPool.query<{ tablename: string }>(
      `select tablename from pg_catalog.pg_tables where schemaname = $1 and tablename <> 'roles' order by tablename`,
      [this.schemaName],
    );
    if (result.rows.length === 0) return;

    const tables = result.rows
      .map(({ tablename }) => `${quoteIdentifier(this.schemaName)}.${quoteIdentifier(tablename)}`)
      .join(', ');
    await this.#administrationPool.query(`truncate table ${tables} cascade`);
  }

  public async query<Row extends QueryResultRow = QueryResultRow>(
    text: string,
    values: readonly unknown[] = [],
  ): Promise<QueryResult<Row>> {
    return this.#inspectionPool.query<Row>(text, [...values]);
  }

  public async close(): Promise<void> {
    if (this.#closed) return;
    this.#closed = true;

    const failures: unknown[] = [];
    try {
      await closeDb();
    } catch (error) {
      failures.push(error);
    }
    try {
      await this.#inspectionPool.end();
    } catch (error) {
      failures.push(error);
    }
    for (const schemaName of [this.migrationSchemaName, this.schemaName]) {
      try {
        await this.#administrationPool.query(`drop schema ${quoteIdentifier(schemaName)} cascade`);
      } catch (error) {
        failures.push(error);
      }
    }
    try {
      await this.#administrationPool.end();
    } catch (error) {
      failures.push(error);
    }

    if (failures.length > 0) {
      throw new AggregateError(failures, 'Failed to dispose PostgreSQL test database.');
    }
  }
}

export async function createPostgresTestDatabase(
  label: string,
  migrate = true,
): Promise<PostgresTestDatabase> {
  return PostgresTestDatabase.create(label, migrate);
}
