/* eslint-disable no-console */
export const logger = {
  info: (message: string, meta?: Record<string, unknown>) => {
    if (meta) {
      console.log(`[INFO] ${message}`, JSON.stringify(meta));
    } else {
      console.log(`[INFO] ${message}`);
    }
  },
  warn: (message: string, meta?: Record<string, unknown>) => {
    if (meta) {
      console.warn(`[WARN] ${message}`, JSON.stringify(meta));
    } else {
      console.warn(`[WARN] ${message}`);
    }
  },
  error: (message: string, error?: unknown) => {
    if (error instanceof Error) {
      console.error(`[ERROR] ${message}: ${error.message}`, {
        stack: error.stack,
      });
    } else if (error) {
      console.error(`[ERROR] ${message}`, error);
    } else {
      console.error(`[ERROR] ${message}`);
    }
  },
};
