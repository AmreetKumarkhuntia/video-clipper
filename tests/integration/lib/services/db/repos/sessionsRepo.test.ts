import { createHash } from 'node:crypto';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import * as schema from '@lib/services/db/schema.js';

const sqlite = new Database(':memory:');
const testDb = drizzle(sqlite, { schema });
migrate(testDb, { migrationsFolder: path.join(process.cwd(), 'drizzle') });

vi.mock('@lib/services/db/client.js', () => ({ db: testDb }));

const { createCustomer } = await import('@lib/services/db/repos/customersRepo.js');
const { deleteExpiredSessions, deleteSession, findValidSession, insertSession } =
  await import('@lib/services/db/repos/sessionsRepo.js');

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

beforeEach(() => {
  sqlite.exec('DELETE FROM sessions; DELETE FROM auth_identities; DELETE FROM customers;');
});

afterAll(() => sqlite.close());

describe('sessionsRepo', () => {
  it('finds an unexpired hashed session without matching the raw token', () => {
    const customer = createCustomer({});
    const idHash = hash('raw-token');
    insertSession(idHash, customer.id, Date.now() + 60_000);

    expect(findValidSession(idHash)?.customerId).toBe(customer.id);
    expect(findValidSession('raw-token')).toBeNull();
  });

  it('does not return an expired session', () => {
    const customer = createCustomer({});
    const idHash = hash('expired-token');
    insertSession(idHash, customer.id, Date.now() - 1);

    expect(findValidSession(idHash)).toBeNull();
  });

  it('deletes one session and sweeps expired sessions without deleting live ones', () => {
    const customer = createCustomer({});
    const live = hash('live');
    const dead = hash('dead');
    insertSession(live, customer.id, Date.now() + 60_000);
    insertSession(dead, customer.id, Date.now() - 1);

    deleteExpiredSessions();
    expect(findValidSession(live)?.customerId).toBe(customer.id);

    deleteSession(live);
    expect(findValidSession(live)).toBeNull();
  });
});
