import { createHash } from 'node:crypto';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  createCustomer,
  deleteExpiredSessions,
  deleteSession,
  findValidSession,
  insertSession,
} from '@lib/services/db/index.js';
import {
  createPostgresTestDatabase,
  type PostgresTestDatabase,
} from '../../../../../support/postgres.js';

let database: PostgresTestDatabase;

function hash(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

beforeAll(async () => {
  database = await createPostgresTestDatabase('sessions_repo');
});

beforeEach(async () => {
  await database.reset();
});

afterAll(async () => {
  await database.close();
});

describe('sessionsRepo', () => {
  it('finds an unexpired hashed session without matching the raw token', async () => {
    const customer = await createCustomer({});
    const idHash = hash('raw-token');
    const expiresAt = Date.now() + 60_000;
    await insertSession(idHash, customer.id, expiresAt);

    expect(await findValidSession(idHash)).toMatchObject({ customerId: customer.id, expiresAt });
    expect(await findValidSession('raw-token')).toBeNull();

    const stored = await database.query<{ expires_at: Date; created_at: Date }>(
      'select expires_at, created_at from sessions where id = $1',
      [idHash],
    );
    expect(stored.rows[0]?.expires_at).toBeInstanceOf(Date);
    expect(stored.rows[0]?.created_at).toBeInstanceOf(Date);
  });

  it('does not return an expired session', async () => {
    const customer = await createCustomer({});
    const idHash = hash('expired-token');
    await insertSession(idHash, customer.id, Date.now() - 1);

    expect(await findValidSession(idHash)).toBeNull();
  });

  it('deletes one session and sweeps expired sessions without deleting live ones', async () => {
    const customer = await createCustomer({});
    const live = hash('live');
    const dead = hash('dead');
    const now = Date.now();
    await insertSession(live, customer.id, now + 60_000);
    await insertSession(dead, customer.id, now - 1);

    await deleteExpiredSessions(now);
    expect((await findValidSession(live))?.customerId).toBe(customer.id);
    expect(await findValidSession(dead)).toBeNull();

    await deleteSession(live);
    expect(await findValidSession(live)).toBeNull();
  });
});
