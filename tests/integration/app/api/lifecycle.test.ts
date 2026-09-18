import { beforeEach, describe, expect, it, vi } from 'vitest';

const lifecycle = vi.hoisted(() => {
  const closeServer = vi.fn((callback: (error?: Error) => void): void => callback());

  return {
    assertMigrationsCurrent: vi.fn(async (): Promise<void> => {}),
    closeDb: vi.fn(async (): Promise<void> => {}),
    closeServer,
    createApp: vi.fn(() => ({ fetch: vi.fn() })),
    deleteExpiredSessions: vi.fn(async (): Promise<number> => 0),
    getConfig: vi.fn(() => ({})),
    getDatabaseConfig: vi.fn(() => ({
      connectionString: 'postgresql://localhost/video_clipper_test',
      max: 1,
      connectionTimeoutMillis: 100,
      idleTimeoutMillis: 100,
    })),
    getTokenEncryptionKey: vi.fn(() => Buffer.alloc(32)),
    initDb: vi.fn(),
    initTokenCipher: vi.fn(),
    pingDb: vi.fn(async (): Promise<void> => {}),
    reencryptIdentityTokens: vi.fn(async (): Promise<number> => 0),
    serve: vi.fn(() => ({ close: closeServer })),
    validateEncryptedIdentityTokens: vi.fn(async (): Promise<void> => {}),
  };
});

vi.mock('@hono/node-server', () => ({ serve: lifecycle.serve }));
vi.mock('@app/api/app.js', () => ({ createApp: lifecycle.createApp }));
vi.mock('@lib/config/index.js', () => ({
  getConfig: lifecycle.getConfig,
  getDatabaseConfig: lifecycle.getDatabaseConfig,
  getTokenEncryptionKey: lifecycle.getTokenEncryptionKey,
}));
vi.mock('@lib/services/encryption/index.js', () => ({
  initTokenCipher: lifecycle.initTokenCipher,
}));
vi.mock('@lib/services/db/index.js', () => ({
  assertMigrationsCurrent: lifecycle.assertMigrationsCurrent,
  closeDb: lifecycle.closeDb,
  deleteExpiredSessions: lifecycle.deleteExpiredSessions,
  initDb: lifecycle.initDb,
  pingDb: lifecycle.pingDb,
  reencryptIdentityTokens: lifecycle.reencryptIdentityTokens,
  validateEncryptedIdentityTokens: lifecycle.validateEncryptedIdentityTokens,
}));

import { startApi } from '@app/api/index.js';

beforeEach((): void => {
  vi.clearAllMocks();
  lifecycle.assertMigrationsCurrent.mockResolvedValue(undefined);
  lifecycle.closeDb.mockResolvedValue(undefined);
  lifecycle.closeServer.mockImplementation((callback: (error?: Error) => void): void => callback());
  lifecycle.deleteExpiredSessions.mockResolvedValue(0);
  lifecycle.pingDb.mockResolvedValue(undefined);
  lifecycle.reencryptIdentityTokens.mockResolvedValue(0);
  lifecycle.validateEncryptedIdentityTokens.mockResolvedValue(undefined);
});

describe('API lifecycle', (): void => {
  it('refuses to listen when PostgreSQL is unavailable and releases the pool', async (): Promise<void> => {
    lifecycle.pingDb.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:5432'));

    await expect(startApi()).rejects.toThrow('ECONNREFUSED');

    expect(lifecycle.assertMigrationsCurrent).not.toHaveBeenCalled();
    expect(lifecycle.validateEncryptedIdentityTokens).not.toHaveBeenCalled();
    expect(lifecycle.serve).not.toHaveBeenCalled();
    expect(lifecycle.closeDb).toHaveBeenCalledOnce();
  });

  it('refuses to listen when the operator has not applied migrations', async (): Promise<void> => {
    lifecycle.assertMigrationsCurrent.mockRejectedValueOnce(
      new Error('Database schema is not initialized. Run `pnpm db:migrate` before startup.'),
    );

    await expect(startApi()).rejects.toThrow('pnpm db:migrate');

    expect(lifecycle.pingDb).toHaveBeenCalledOnce();
    expect(lifecycle.validateEncryptedIdentityTokens).not.toHaveBeenCalled();
    expect(lifecycle.deleteExpiredSessions).not.toHaveBeenCalled();
    expect(lifecycle.serve).not.toHaveBeenCalled();
    expect(lifecycle.closeDb).toHaveBeenCalledOnce();
  });

  it('verifies persistence before listening and drains HTTP and PostgreSQL on shutdown', async (): Promise<void> => {
    const runtime = await startApi();

    expect(lifecycle.pingDb.mock.invocationCallOrder[0]).toBeLessThan(
      lifecycle.assertMigrationsCurrent.mock.invocationCallOrder[0]!,
    );
    expect(lifecycle.assertMigrationsCurrent.mock.invocationCallOrder[0]).toBeLessThan(
      lifecycle.validateEncryptedIdentityTokens.mock.invocationCallOrder[0]!,
    );
    expect(lifecycle.validateEncryptedIdentityTokens.mock.invocationCallOrder[0]).toBeLessThan(
      lifecycle.deleteExpiredSessions.mock.invocationCallOrder[0]!,
    );
    expect(lifecycle.deleteExpiredSessions.mock.invocationCallOrder[0]).toBeLessThan(
      lifecycle.serve.mock.invocationCallOrder[0]!,
    );

    await runtime.shutdown('SIGTERM');
    await runtime.shutdown('SIGINT');

    expect(lifecycle.closeServer).toHaveBeenCalledOnce();
    expect(lifecycle.closeDb).toHaveBeenCalledOnce();
    expect(lifecycle.closeServer.mock.invocationCallOrder[0]).toBeLessThan(
      lifecycle.closeDb.mock.invocationCallOrder[0]!,
    );
  });

  it('still drains the pool when the HTTP server fails to close', async (): Promise<void> => {
    lifecycle.closeServer.mockImplementationOnce((callback: (error?: Error) => void): void => {
      callback(new Error('server close failed'));
    });
    const runtime = await startApi();

    await expect(runtime.shutdown('SIGTERM')).rejects.toThrow('server close failed');

    expect(lifecycle.closeDb).toHaveBeenCalledOnce();
  });

  it('reports database cleanup failures alongside the startup failure', async (): Promise<void> => {
    lifecycle.pingDb.mockRejectedValueOnce(new Error('database unavailable'));
    lifecycle.closeDb.mockRejectedValueOnce(new Error('pool close failed'));

    await expect(startApi()).rejects.toMatchObject({
      message: 'API startup and database cleanup failed.',
      errors: [expect.objectContaining({ message: 'database unavailable' }), expect.any(Error)],
    });

    expect(lifecycle.serve).not.toHaveBeenCalled();
  });
});
