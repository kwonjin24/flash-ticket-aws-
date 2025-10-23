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

    const logger = new Logger('QueueRedis');
    const client = new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });

    client.on('connect', () => {
      logger.log(`Connected to Redis at ${host}:${port}`);
    });

    client.on('error', (error) => {
      logger.error(`Redis connection error: ${error.message}`);
    });

    return client;
  },
};
