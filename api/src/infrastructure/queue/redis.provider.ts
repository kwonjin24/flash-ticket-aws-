import { ConfigService } from '@nestjs/config';
import { FactoryProvider } from '@nestjs/common';
import { Redis } from 'ioredis';

export const REDIS_QUEUE_CLIENT = Symbol('REDIS_QUEUE_CLIENT');

export const redisQueueProvider: FactoryProvider<Redis> = {
  provide: REDIS_QUEUE_CLIENT,
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const host = configService.get<string>('REDIS_HOST') ?? 'localhost';
    const port = Number(configService.get<number>('REDIS_PORT') ?? 6379);
    const password = configService.get<string>('REDIS_PASSWORD') ?? undefined;

    return new Redis({
      host,
      port,
      password,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    });
  },
};
