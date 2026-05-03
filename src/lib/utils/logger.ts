const LEVELS = {
  info: '[info]',
  warn: '[warn]',
  error: '[error]',
} as const;

export const log = {
  info: (msg: string): void => {
    console.log(`${LEVELS.info} ${msg}`);
  },
  warn: (msg: string): void => {
    console.warn(`${LEVELS.warn} ${msg}`);
  },
  error: (msg: string): void => {
    console.error(`${LEVELS.error} ${msg}`);
  },
  progress: (data: Buffer | string): void => {
    const text = String(data);
    const lines = text.split('\n').filter((line) => line.trim());

    for (const line of lines) {
      const progressMatch = line.match(/\[download\]\s+(\d+\.?\d*%)/);
      if (progressMatch) {
        process.stdout.write(`\r${progressMatch[0]}`);
      }
    }
  },
};
