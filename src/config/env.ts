import 'dotenv/config';
import { ConfigSchema } from '../types/config.js';

function loadConfig() {
  const result = ConfigSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    console.error(`[error] Invalid configuration:\n${issues}`);
    process.exit(1);
  }

  return result.data;
}

export const config = loadConfig();
