import { Queue, QueueEvents, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config.js';
import { logger } from './logger.js';
import { PaymentRequestJob, PaymentResultPayload } from './types.js';
import { pickFailureReason, sleep } from './utils.js';

const config = loadConfig();

logger.info('Starting mock payment processor', {
  requestQueue: config.requestQueue,
  resultQueue: config.resultQueue,
  successRate: config.successRate,
  minProcessingMs: config.minProcessingMs,
  maxProcessingMs: config.maxProcessingMs,
});

const queueOptions = { connection: config.redisUrl } as const;

const resultQueue = new Queue<PaymentResultPayload>(config.resultQueue, queueOptions);
const requestQueueEvents = new QueueEvents(config.requestQueue, queueOptions);

const worker = new Worker<PaymentRequestJob>(
  config.requestQueue,
  async (job) => {
    const processingTime = Math.floor(
      Math.random() * (config.maxProcessingMs - config.minProcessingMs + 1),
    ) + config.minProcessingMs;

    logger.info('Processing payment request', {
      jobId: job.id,
      orderId: job.data.orderId,
      paymentId: job.data.paymentId,
      processingTime,
    });

    await sleep(processingTime);

    const succeeded = Math.random() <= config.successRate;
    const status: PaymentResultPayload['status'] = succeeded ? 'OK' : 'FAIL';
    const payload: PaymentResultPayload = {
      requestId: job.data.requestId,
      paymentId: job.data.paymentId,
      orderId: job.data.orderId,
      status,
      processedAt: new Date().toISOString(),
      message: succeeded ? '결제가 완료되었습니다.' : pickFailureReason(),
    };

    await resultQueue.add(
      'payment-result',
      payload,
      {
        jobId: randomUUID(),
        removeOnComplete: { age: 3600, count: 500 },
        removeOnFail: { age: 3600, count: 100 },
      },
    );

    logger.info('Payment result published', {
      orderId: payload.orderId,
      paymentId: payload.paymentId,
      status: payload.status,
    });

    return payload;
  },
  {
    ...queueOptions,
    autorun: true,
  },
);

worker.on('completed', (job) => {
  logger.info('Payment job completed', {
    jobId: job.id,
  });
});

worker.on('failed', (job, error) => {
  logger.error('Payment job failed', error ?? undefined);
  if (job) {
    logger.warn('Job payload', { jobId: job.id, data: job.data });
  }
});

requestQueueEvents.on('failed', ({ jobId, failedReason }) => {
  logger.warn('Payment request job failed before processing', {
    jobId,
    failedReason,
  });
});

const shutdown = async () => {
  logger.info('Shutting down mock payment processor');
  await Promise.allSettled([
    worker.close(),
    resultQueue.close(),
    requestQueueEvents.close(),
  ]);
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
