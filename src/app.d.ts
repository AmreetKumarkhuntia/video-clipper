import type { Config } from '@lib/types/config.js';

declare global {
  namespace App {
    interface Locals {
      requestId: string;
      config: Config;
    }
  }
}

export {};
