import dotenv from 'dotenv';
import path from 'node:path';

const loadEnvironment = () => {
  const shouldLoadEnvFiles =
    (process.env.LOAD_ENV_FILES ?? 'true').toLowerCase() !== 'false';
  if (!shouldLoadEnvFiles) {
    if (process.env.NODE_ENV !== 'test') {
      console.info(
        '[PayConfig] LOAD_ENV_FILES=false, runtime environment variables only',
      );
    }
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    console.info('[PayConfig] Loading environment files as fallback');
  }

  const env = process.env.NODE_ENV ?? 'local';
  const candidates = [
    `.env.${env}.local`,
    `.env.${env}`,
    '.env.local',
    '.env',
  ];
  const cwd = process.cwd();
  const root = path.resolve(cwd, '..');
  for (const base of candidates) {
    const paths = [path.resolve(root, base), path.resolve(cwd, base)];
    for (const filePath of paths) {
      dotenv.config({ path: filePath, override: false });
    }
  }
};

loadEnvironment();

export type PaymentMockConfig = {
  amqpUrl: string;
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

const buildAmqpUrl = (): string => {
  if (process.env.RABBITMQ_URL) {
    return process.env.RABBITMQ_URL;
  }

  const host = process.env.RABBITMQ_HOST ?? '127.0.0.1';
  const port = parseNumber(process.env.RABBITMQ_PORT, 5672);
  const user = process.env.RABBITMQ_USER ?? 'guest';
  const password = process.env.RABBITMQ_PASSWORD ?? 'guest';
  const vhost = process.env.RABBITMQ_VHOST ?? '/';

  const encodedUser = encodeURIComponent(user);
  const encodedPass = encodeURIComponent(password);
  const encodedVhost = encodeURIComponent(vhost);

  return `amqp://${encodedUser}:${encodedPass}@${host}:${port}/${encodedVhost}`;
};

export const loadConfig = (): PaymentMockConfig => {
  const amqpUrl = buildAmqpUrl();

  const successRateEnv = parseNumber(process.env.PAYMENT_SUCCESS_RATE, 0.85);
  const successRate = clamp(successRateEnv, 0, 1);

  const minProcessingMs = parseNumber(process.env.PAYMENT_PROCESSING_MIN_MS, 1_000);
  const maxProcessingMs = Math.max(
    minProcessingMs,
    parseNumber(process.env.PAYMENT_PROCESSING_MAX_MS, 4_000),
  );

  return {
    amqpUrl,
    requestQueue: process.env.PAYMENT_REQUEST_QUEUE ?? 'payments_request',
    resultQueue: process.env.PAYMENT_RESULT_QUEUE ?? 'payments_result',
    successRate,
    minProcessingMs,
    maxProcessingMs,
  };
};
