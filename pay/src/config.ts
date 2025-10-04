import 'dotenv/config';

export type PaymentMockConfig = {
  redisUrl: string;
  requestQueue: string;
  resultQueue: string;
  successRate: number;
  minProcessingMs: number;
  maxProcessingMs: number;
};

const parseNumber = (value: string | undefined, fallback: number): number => {
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.min(Math.max(value, min), max);

export const loadConfig = (): PaymentMockConfig => {
  const host = process.env.REDIS_HOST ?? '127.0.0.1';
  const port = parseNumber(process.env.REDIS_PORT, 6379);
  const password = process.env.REDIS_PASSWORD;
  const redisUrl = password
    ? `redis://:${password}@${host}:${port}`
    : `redis://${host}:${port}`;

  const successRateEnv = parseNumber(process.env.PAYMENT_SUCCESS_RATE, 0.85);
  const successRate = clamp(successRateEnv, 0, 1);

  const minProcessingMs = parseNumber(process.env.PAYMENT_PROCESSING_MIN_MS, 1_000);
  const maxProcessingMs = Math.max(
    minProcessingMs,
    parseNumber(process.env.PAYMENT_PROCESSING_MAX_MS, 4_000),
  );

  return {
    redisUrl,
    requestQueue: process.env.PAYMENT_REQUEST_QUEUE ?? 'payments:request',
    resultQueue: process.env.PAYMENT_RESULT_QUEUE ?? 'payments:result',
    successRate,
    minProcessingMs,
    maxProcessingMs,
  };
};
