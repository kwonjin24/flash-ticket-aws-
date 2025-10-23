import { FactoryProvider } from '@nestjs/common';
import { Redis } from 'ioredis';
export declare const REDIS_QUEUE_CLIENT: unique symbol;
export declare const redisQueueProvider: FactoryProvider<Redis>;
