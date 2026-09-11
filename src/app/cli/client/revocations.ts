import {
  deletePendingRevocation,
  queueCredentialRevocation,
  readPendingRevocations,
} from './credentials.js';
import { revokeSession } from './index.js';
import type { RevocationRetryResult, SessionRevoker } from '@lib/types/command.js';

/**
 * Moves the active credential out of use, then retries every queued server
 * revocation. Failures stay queued and are deliberately reduced to a count so
 * a bearer can never escape through an upstream error or diagnostic.
 */
export async function retireStoredSessions(
  baseUrl: string,
  revoker: SessionRevoker = revokeSession,
  dir?: string,
): Promise<RevocationRetryResult> {
  const movedActive = queueCredentialRevocation(baseUrl, dir);
  const pending = readPendingRevocations(baseUrl, dir);
  let failures = 0;

  for (const token of pending) {
    try {
      await revoker(token);
      deletePendingRevocation(baseUrl, token, dir);
    } catch {
      failures++;
    }
  }

  return { hadSessions: movedActive || pending.length > 0, failures };
}
