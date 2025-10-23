import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { QueueTicketState } from '../types/queue-ticket-state.type';
export declare const GLOBAL_QUEUE_EVENT_ID = "__global__";
export declare class QueueTicketService {
    private readonly redis;
    private readonly configService;
    private readonly promotionIntervalMs;
    private readonly gateTokenTtlMs;
    private readonly readyCapacity;
    constructor(redis: Redis, configService: ConfigService);
    getPromotionIntervalMs(): number;
    getReadyCapacity(): number;
    getQueueLength(eventId: string): Promise<number>;
    enqueue(userId: string, eventId: string): Promise<{
        ticketId: string;
    }>;
    getStatus(ticketId: string): Promise<{
        state: QueueTicketState;
        position?: number;
        gateToken?: string;
    }>;
    enter(userId: string, ticketId: string, gateToken: string): Promise<void>;
    lockGateTokenForOrder(gateToken: string, userId: string, eventId: string): Promise<{
        ticketId: string;
    }>;
    markOrderSuccess(ticketId: string, gateToken: string, orderId: string): Promise<void>;
    releaseOrderLock(ticketId: string): Promise<void>;
    promoteTickets(): Promise<void>;
    private calculateAvailableSlots;
    private refreshExpiration;
    private expireTicket;
}
