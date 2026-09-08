import type { Config } from '@lib/types/config.js';
import type { Customer } from '@lib/types/auth.js';

/**
 * The request context every backend handler sees.
 *
 * Mirrors what SvelteKit's `locals` carried in the prototype, so handler bodies
 * read the same way, but it is owned by this app rather than a framework.
 *
 * `customer` is optional because the session middleware resolves rather than
 * guards: an anonymous request reaches the handler with no customer set, and
 * the route decides whether that is allowed.
 */
export type ApiEnv = {
  Variables: {
    requestId: string;
    config: Config;
    customer?: Customer;
  };
};
