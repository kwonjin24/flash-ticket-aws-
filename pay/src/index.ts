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

const MAX_RETRY_ATTEMPTS = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

logger.info(`[Pay] Process started at ${new Date().toISOString()}`);
logger.info('[Pay] Starting mock payment processor', {
  requestQueue: config.requestQueue,
  resultQueue: config.resultQueue,
  successRate: config.successRate,
  minProcessingMs: config.minProcessingMs,
  maxProcessingMs: config.maxProcessingMs,
});

const connectWithRetry = async (
  url: string,
  attempt: number = 1,
): Promise<Connection> => {
  try {
    logger.info(`[Pay] Connecting to RabbitMQ (attempt ${attempt}/${MAX_RETRY_ATTEMPTS})`, {
      url: url.replace(/:[^@]*@/, ':***@'), // Mask password
    });
    const conn = await connect(url);
    logger.info('[Pay] ✅ Successfully connected to RabbitMQ');
    return conn;
  } catch (error) {
    if (attempt >= MAX_RETRY_ATTEMPTS) {
      logger.error(
        `[Pay] ❌ Failed to connect to RabbitMQ after ${MAX_RETRY_ATTEMPTS} attempts`,
        error,
      );
      throw error;
    }
    const delay = INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt - 1);
    logger.warn(`[Pay] ⚠️ Connection failed, retrying in ${delay}ms...`);
    if (error instanceof Error) {
      logger.error(`[Pay] Connection error details: ${error.message}`, error);
    }
    await sleep(delay);
    return connectWithRetry(url, attempt + 1);
  }
};

const ensureChannel = async (): Promise<Channel> => {
  if (channel) {
    return channel;
  }

  try {
    logger.info('[Pay] Creating RabbitMQ connection...');
    connection = await connectWithRetry(config.amqpUrl);

    logger.info('[Pay] Creating channel...');
    channel = await connection.createChannel();
    logger.info('[Pay] ✅ Channel created');

    logger.info('[Pay] Asserting request queue...', {
      queue: config.requestQueue,
    });
    await channel.assertQueue(config.requestQueue, { durable: true });
    logger.info('[Pay] ✅ Request queue ready');

    logger.info('[Pay] Asserting result queue...', {
      queue: config.resultQueue,
    });
    await channel.assertQueue(config.resultQueue, { durable: true });
    logger.info('[Pay] ✅ Result queue ready');

    logger.info('[Pay] Setting prefetch to 1');
    channel.prefetch(1);
    logger.info('[Pay] ✅ Prefetch set');

    logger.info('[Pay] ✅ Mock payment processor ready', {
      requestQueue: config.requestQueue,
      resultQueue: config.resultQueue,
    });

    return channel;
  } catch (error) {
    logger.error('[Pay] ❌ Failed to ensure channel', error);
    throw error;
  }
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
    logger.info('[Pay] Initializing payment processor...');
    const ch = await ensureChannel();

    logger.info('[Pay] 🚀 Starting to consume payment requests...');
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

    logger.info('[Pay] ✅ Payment processor started successfully');
    logger.info(`[Pay] Listening to queue: ${config.requestQueue}`);
  } catch (error) {
    logger.error('[Pay] ❌ Failed to start mock payment processor', error);
    process.exit(1);
  }
};

const shutdown = async () => {
  logger.info('[Pay] 🛑 Shutting down mock payment processor');
  try {
    if (channel) {
      logger.info('[Pay] Closing channel...');
      await channel.close();
      logger.info('[Pay] ✅ Channel closed');
    }
    if (connection) {
      logger.info('[Pay] Closing connection...');
      await connection.close();
      logger.info('[Pay] ✅ Connection closed');
    }
    logger.info('[Pay] ✅ Shutdown completed gracefully');
  } catch (error) {
    logger.error('[Pay] ⚠️ Error during shutdown', error);
  } finally {
    process.exit(0);
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

logger.info('[Pay] 🔧 Initializing payment processor...');
start();
