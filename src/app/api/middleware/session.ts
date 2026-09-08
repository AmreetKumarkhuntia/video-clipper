import { timingSafeEqual } from 'node:crypto';
import { resolveSession } from '@lib/orchestration/auth/index.js';
import { hashSessionToken } from '@lib/utils/sessionToken.js';
import { readSessionToken } from '../http/sessionCookies.js';
import { HttpError, jsonError } from '../http/responses.js';
import type { Context, MiddlewareHandler } from 'hono';
import type { Customer } from '@lib/types/auth.js';
import type { ApiEnv } from '../context.js';

/**
 * Resolves the session cookie into `c.get('customer')` for every request.
 *
 * Resolving is not guarding: this sets the customer when there is one and moves
 * on when there is not, so a route can be public, customer-scoped, or behave
 * differently for each. Routes that require a customer call `requireCustomer`.
 */
export const session: MiddlewareHandler<ApiEnv> = async (c, next) => {
  const customer = resolveSession(readSessionToken(c));
  if (customer) c.set('customer', customer);
  await next();
};

/**
 * Guard for a customer-scoped route. Returns the customer, or throws a 401 the
 * error handler passes through untouched.
 *
 * Throwing rather than returning a union keeps the handlers flat: everything
 * after this line can treat the customer as present, which is what let the
 * ported routes drop the prototype's per-route `isGuardFailure` branch.
 */
export function requireCustomer(c: Context<ApiEnv>): Customer {
  const customer = c.get('customer');
  if (!customer) throw new HttpError(jsonError(401, 'Sign in to continue.'));
  return customer;
}

/**
 * Guard for operator-scoped routes — config writes today. A bearer token
 * rather than a session, because the CLI has no way to sign in; RBAC on the
 * session is the planned replacement, and it swaps out this one function.
 * An unset token means locked, not open.
 */
export function requireOperator(c: Context<ApiEnv>): void {
  const expected = c.get('config').OPERATOR_TOKEN;
  if (!expected) {
    throw new HttpError(
      jsonError(403, 'Settings are locked. Set OPERATOR_TOKEN on the server to allow changes.'),
    );
  }
  const header = c.req.header('authorization');
  const presented = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
  // Hashing both sides first gives timingSafeEqual the equal-length buffers it
  // requires, without leaking the token's length through an early return.
  const match =
    presented !== '' &&
    timingSafeEqual(
      Buffer.from(hashSessionToken(presented)),
      Buffer.from(hashSessionToken(expected)),
    );
  if (!match) throw new HttpError(jsonError(401, 'Operator token required.'));
}
