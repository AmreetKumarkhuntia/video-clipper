import type { Customer } from '@lib/types/auth.js';

declare global {
  namespace App {
    interface Locals {
      requestId: string;
    }

    /**
     * Set by the root layout load, which asks the backend rather than reading a
     * database — this app has no session of its own to consult.
     */
    interface PageData {
      customer?: Customer | null;
      channelTitle?: string | null;
    }
  }
}

export {};
