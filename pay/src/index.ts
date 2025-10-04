import { connect, Connection, Channel, ConsumeMessage } from 'amqplib';
import { randomUUID } from 'node:crypto';
import { loadConfig } from './config';
import { logger } from './logger';
import {
  PaymentRequestMessage,
  PaymentResultMessage,
} from './types';
import { pickFailureReason, sleep } from './utils';

const config = loadConfig();

let connection: Connection | null = null;
let channel: Channel | null = null;

logger.info('Starting mock payment processor', {
  requestQueue: config.requestQueue,
  resultQueue: config.resultQueue,
  successRate: config.successRate,
  minProcessingMs: config.minProcessingMs,
  maxProcessingMs: config.maxProcessingMs,
});

const ensureChannel = async (): Promise<Channel> => {
  if (channel) {
    return channel;
  }

  connection = await connect(config.amqpUrl);
  channel = await connection.createChannel();

  await channel.assertQueue(config.requestQueue, { durable: true });
  await channel.assertQueue(config.resultQueue, { durable: true });
  channel.prefetch(1);

  logger.info('Mock payment processor ready', {
    requestQueue: config.requestQueue,
    resultQueue: config.resultQueue,
  });

  return channel;
};

const processMessage = async (msg: ConsumeMessage, ch: Channel): Promise<void> => {
  try {
    const payload = JSON.parse(msg.content.toString()) as PaymentRequestMessage;
    const processingTime =
      Math.floor(
        Math.random() * (config.maxProcessingMs - config.minProcessingMs + 1),
      ) + config.minProcessingMs;

    logger.info('Processing payment request', {
      requestId: payload.requestId,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      userId: payload.userId,
      processingTime,
    });

    await sleep(processingTime);

    const succeeded = Math.random() <= config.successRate;
    const status: PaymentResultMessage['status'] = succeeded ? 'OK' : 'FAIL';

    const result: PaymentResultMessage = {
      requestId: payload.requestId,
      paymentId: payload.paymentId,
      orderId: payload.orderId,
      userId: payload.userId,
      status,
      processedAt: new Date().toISOString(),
      message: succeeded ? '결제가 완료되었습니다.' : pickFailureReason(),
    };

    const resultBuffer = Buffer.from(JSON.stringify(result));
    ch.sendToQueue(config.resultQueue, resultBuffer, {
      persistent: true,
      contentType: 'application/json',
      messageId: randomUUID(),
      correlationId: payload.requestId,
    });

    ch.ack(msg);
    logger.info('Payment result published', {
      requestId: result.requestId,
      paymentId: result.paymentId,
      status: result.status,
    });
  } catch (error) {
    logger.error('Failed to process payment request', error);
    ch.nack(msg, false, false);
  }
};

const start = async () => {
  try {
    const ch = await ensureChannel();

    ch.consume(
      config.requestQueue,
      async (msg: ConsumeMessage | null) => {
        if (!msg) {
          return;
        }
        await processMessage(msg, ch);
      },
      { noAck: false },
    );
  } catch (error) {
    logger.error('Failed to start mock payment processor', error);
    process.exit(1);
  }
};

const shutdown = async () => {
  logger.info('Shutting down mock payment processor');
  try {
    await channel?.close();
    await connection?.close();
  } catch (error) {
    logger.error('Failed to shutdown gracefully', error);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

start();
