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
};
