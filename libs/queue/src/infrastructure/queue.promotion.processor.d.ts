import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Redis } from 'ioredis';
import { QueueTicketService } from '../application/services/queue-ticket.service';
export declare class QueuePromotionProcessor implements OnModuleInit, OnModuleDestroy {
    private readonly redis;
    private readonly queueTicketService;
    private readonly logger;
    private queue;
    private worker;
    constructor(redis: Redis, queueTicketService: QueueTicketService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
}
