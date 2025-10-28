import { ConfigService } from '@nestjs/config';
import { FactoryProvider, Logger } from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS_QUEUE_CLIENT = Symbol('REDIS_QUEUE_CLIENT');

export const redisQueueProvider: FactoryProvider<Redis> = {
  provide: REDIS_QUEUE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('REDIS_HOST') ?? 'localhost';
    const port = Number(configService.get<number>('REDIS_PORT') ?? 6379);
    const password = configService.get<string>('REDIS_PASSWORD') ?? undefined;
    const tls = configService.get<string>('REDIS_TLS') === 'true';

    const logger = new Logger('QueueRedis');

    logger.debug(`[Redis] Initializing connection to ${host}:${port}${tls ? ' (TLS enabled)' : ''}`);

    const redisOptions = {
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: true,
      // Connection timeouts - increased for heavy operations like promoteTickets()
      connectTimeout: 10000,
      commandTimeout: 10000,
      maxReconnectingDelay: 3000,
      retryStrategy: (times: number) => {
        const delay = Math.min(times * 50, 2000);
        logger.warn(`[Redis] Retrying connection (attempt ${times}, delay ${delay}ms)`);
        return delay;
      },
      // Reconnection settings
      lazyConnect: false,
      keepAlive: 30000,
      // TLS/SSL settings if enabled
      ...(tls && { tls: {} }),
    };

    logger.log(`[Redis] Connection options: host=${host}, port=${port}, tls=${tls}, connectTimeout=10000ms, commandTimeout=10000ms, enableReadyCheck=true`);

    const client = new Redis(redisOptions);

    client.on('connect', () => {
      logger.log(`[Redis] ✅ Connected to Redis at ${host}:${port}`);
    });

    client.on('ready', () => {
      logger.log(`[Redis] ✅ Redis client is ready`);
    });

    client.on('reconnecting', () => {
      logger.warn(`[Redis] ⚠️ Attempting to reconnect to Redis`);
    });

    client.on('error', (error: any) => {
      logger.error(`[Redis] ❌ Redis error: ${error.message}`, error.stack);
    });

    client.on('close', () => {
      logger.warn(`[Redis] ⚠️ Redis connection closed`);
    });

    client.on('end', () => {
      logger.warn(`[Redis] ⚠️ Redis connection ended`);
    });

    return client;
  },
};
