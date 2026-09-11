import { resolveSession } from '@lib/orchestration/auth/index.js';
import { readSessionToken } from '../http/sessionCookies.js';
import { HttpError, jsonError } from '../http/responses.js';
import type { Context, MiddlewareHandler } from 'hono';
import type { Customer, Permission } from '@lib/types/auth.js';
import type { ApiEnv } from '../context.js';

/**
 * Resolves the session — cookie or bearer header — into `c.get('customer')`
 * for every request.
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
 * Guard for a route that needs a specific permission. 401 when nobody is
 * signed in, 403 when someone is but may not do this — two different fixes,
 * so two different answers.
 *
 * Asks for a permission rather than a role: a third role later is a seed row
 * in `roles.permissions`, not a change to every route that checks it.
 */
export function requirePermission(c: Context<ApiEnv>, permission: Permission): Customer {
  const customer = requireCustomer(c);
  if (!customer.permissions.includes(permission)) {
    throw new HttpError(
      jsonError(403, 'You do not have permission to do this.', `requires ${permission}`),
    );
  }
  return customer;
}
