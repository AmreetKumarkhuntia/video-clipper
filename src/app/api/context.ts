import type { Config } from '@lib/types/config.js';

/**
 * The request context every backend handler sees.
 *
 * Mirrors what SvelteKit's `locals` carried in the prototype, so handler bodies
 * read the same way, but it is owned by this app rather than a framework.
 * The signed-in customer joins this once the identity layer lands.
 */
export type ApiEnv = {
  Variables: {
    requestId: string;
    config: Config;
  };
};
