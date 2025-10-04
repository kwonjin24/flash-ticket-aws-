import {
  Inject,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { QueueTicketState } from '../types/queue-ticket-state.type';
import { REDIS_QUEUE_CLIENT } from '../../../infrastructure/queue/redis.provider';

const EVENTS_SET_KEY = 'queue:events';
const TICKET_KEY = (ticketId: string) => `queue:ticket:${ticketId}`;
const QUEUE_KEY = (eventId: string) => `queue:event:${eventId}:queue`;
const READY_SET_KEY = (eventId: string) => `queue:event:${eventId}:ready`;
const GATE_TOKEN_KEY = (gateToken: string) => `queue:ticket:${gateToken}`;

export const GLOBAL_QUEUE_EVENT_ID = '__global__';

const TICKET_STATE_FIELD = 'state';
const TICKET_EVENT_FIELD = 'eventId';
const TICKET_USER_FIELD = 'userId';
const TICKET_CREATED_AT_FIELD = 'createdAt';
const TICKET_GATE_TOKEN_FIELD = 'gateToken';
const TICKET_EXPIRES_AT_FIELD = 'expiresAt';
const TICKET_USED_AT_FIELD = 'usedAt';
const TICKET_ORDER_ID_FIELD = 'orderId';

@Injectable()
export class QueueTicketService {
  private readonly promotionIntervalMs: number;
  private readonly gateTokenTtlMs: number;
  private readonly readyCapacity: number;

  constructor(
    @Inject(REDIS_QUEUE_CLIENT) private readonly redis: Redis,
    private readonly configService: ConfigService,
  ) {
    this.readyCapacity = Number(
      this.configService.get('QUEUE_READY_CAPACITY') ?? 50,
    );
    this.gateTokenTtlMs = Number(
      this.configService.get('QUEUE_GATE_TOKEN_TTL_MS') ?? 120_000,
    );
    this.promotionIntervalMs = Number(
      this.configService.get('QUEUE_PROMOTION_INTERVAL_MS') ?? 5_000,
    );
  }

  getPromotionIntervalMs(): number {
    return this.promotionIntervalMs;
  }

  getReadyCapacity(): number {
    return this.readyCapacity;
  }

  async getQueueLength(eventId: string): Promise<number> {
    return this.redis.zcard(QUEUE_KEY(eventId));
  }

  async enqueue(
    userId: string,
    eventId: string,
  ): Promise<{ ticketId: string }> {
    const ticketId = randomUUID();
    const now = Date.now();
    const multi = this.redis.multi();
    multi.hset(TICKET_KEY(ticketId), {
      [TICKET_USER_FIELD]: userId,
      [TICKET_EVENT_FIELD]: eventId,
      [TICKET_STATE_FIELD]: 'QUEUED',
      [TICKET_CREATED_AT_FIELD]: now.toString(),
    });
    multi.zadd(QUEUE_KEY(eventId), now, ticketId);
    multi.sadd(EVENTS_SET_KEY, eventId);
    await multi.exec();
    return { ticketId };
  }

  async getStatus(ticketId: string): Promise<{
    state: QueueTicketState;
    position?: number;
    gateToken?: string;
  }> {
    const ticket = await this.redis.hgetall(TICKET_KEY(ticketId));
    if (!ticket || Object.keys(ticket).length === 0) {
      throw new NotFoundException('Queue ticket not found');
    }

    await this.refreshExpiration(ticketId, ticket);

    const state = (ticket[TICKET_STATE_FIELD] as QueueTicketState) ?? 'QUEUED';
    if (state === 'QUEUED') {
      const rank = await this.redis.zrank(
        QUEUE_KEY(ticket[TICKET_EVENT_FIELD]),
        ticketId,
      );
      const position = typeof rank === 'number' ? rank + 1 : undefined;
      return { state, position };
    }

    if (state === 'READY') {
      return {
        state,
        gateToken: ticket[TICKET_GATE_TOKEN_FIELD] ?? undefined,
      };
    }

    return { state };
  }

  async enter(
    userId: string,
    ticketId: string,
    gateToken: string,
  ): Promise<void> {
    const ticketKey = TICKET_KEY(ticketId);
    const ticket = await this.redis.hgetall(ticketKey);
    if (!ticket || Object.keys(ticket).length === 0) {
      throw new NotFoundException('Queue ticket not found');
    }

    await this.refreshExpiration(ticketId, ticket);

    if (ticket[TICKET_USER_FIELD] !== userId) {
      throw new UnauthorizedException('Ticket does not belong to this user');
    }

    if (ticket[TICKET_STATE_FIELD] !== 'READY') {
      throw new UnauthorizedException('Ticket is not ready to enter');
    }

    if (ticket[TICKET_GATE_TOKEN_FIELD] !== gateToken) {
      throw new UnauthorizedException('Gate token mismatch');
    }

    const multi = this.redis.multi();
    const expiresAt = Date.now() + this.gateTokenTtlMs;
    multi.hset(ticketKey, {
      [TICKET_STATE_FIELD]: 'USED',
      [TICKET_USED_AT_FIELD]: Date.now().toString(),
      [TICKET_EXPIRES_AT_FIELD]: expiresAt.toString(),
    });
    multi.srem(READY_SET_KEY(ticket[TICKET_EVENT_FIELD]), ticketId);
    multi.pexpire(GATE_TOKEN_KEY(gateToken), this.gateTokenTtlMs);
    await multi.exec();
  }

  async lockGateTokenForOrder(
    gateToken: string,
    userId: string,
    eventId: string,
  ): Promise<{ ticketId: string }> {
    console.log(`redis query : ${GATE_TOKEN_KEY(gateToken)}`);
    const ticketId = await this.redis.get(GATE_TOKEN_KEY(gateToken));
    console.log(`redis result : ${ticketId}`);
    if (!ticketId) {
      throw new UnauthorizedException('Gate token is invalid or expired');
    }

    const ticketKey = TICKET_KEY(ticketId);
    console.log(`redis query : ${ticketKey}`);

    await this.redis.watch(ticketKey);
    try {
      const ticket = await this.redis.hgetall(ticketKey);
      console.log(`redis result : ${JSON.stringify(ticket)}`);
      if (!ticket || Object.keys(ticket).length === 0) {
        throw new NotFoundException('Queue ticket not found');
      }

      console.log(
        `Comparing userId ${ticket[TICKET_USER_FIELD]} with ${userId}`,
      );
      if (ticket[TICKET_USER_FIELD] !== userId) {
        throw new UnauthorizedException(
          'Gate token does not belong to this user',
        );
      }

      if (
        ticket[TICKET_EVENT_FIELD] !== eventId &&
        ticket[TICKET_EVENT_FIELD] !== GLOBAL_QUEUE_EVENT_ID
      ) {
        throw new UnauthorizedException('Gate token does not match event');
      }

      if (ticket[TICKET_STATE_FIELD] !== 'READY') {
        throw new UnauthorizedException('Gate token has not been entered yet');
      }

      if (ticket[TICKET_ORDER_ID_FIELD]) {
        throw new UnauthorizedException('Gate token already locked');
      }

      const multi = this.redis.multi();
      multi.hset(ticketKey, {
        [TICKET_STATE_FIELD]: 'ORDER_PENDING',
        [TICKET_ORDER_ID_FIELD]: 'LOCKED',
      });
      const result = await multi.exec();
      if (!result) {
        throw new UnauthorizedException('Gate token already locked');
      }

      return { ticketId };
    } finally {
      await this.redis.unwatch();
    }
  }

  async markOrderSuccess(
    ticketId: string,
    gateToken: string,
    orderId: string,
  ): Promise<void> {
    const ticketKey = TICKET_KEY(ticketId);
    const ticket = await this.redis.hgetall(ticketKey);
    if (!ticket || Object.keys(ticket).length === 0) {
      throw new NotFoundException('Queue ticket not found');
    }

    if (ticket[TICKET_STATE_FIELD] !== 'ORDER_PENDING') {
      throw new UnauthorizedException('Gate token lock not held');
    }

    const multi = this.redis.multi();
    multi.hset(ticketKey, {
      [TICKET_STATE_FIELD]: 'ORDERED',
      [TICKET_ORDER_ID_FIELD]: orderId,
    });
    multi.del(GATE_TOKEN_KEY(gateToken));
    await multi.exec();
  }

  async releaseOrderLock(ticketId: string): Promise<void> {
    const ticketKey = TICKET_KEY(ticketId);
    const ticket = await this.redis.hgetall(ticketKey);
    if (!ticket || Object.keys(ticket).length === 0) {
      return;
    }

    if (ticket[TICKET_STATE_FIELD] !== 'ORDER_PENDING') {
      return;
    }

    const multi = this.redis.multi();
    multi.hset(ticketKey, {
      [TICKET_STATE_FIELD]: 'USED',
    });
    multi.hdel(ticketKey, TICKET_ORDER_ID_FIELD);
    await multi.exec();
  }

  async promoteTickets(): Promise<void> {
    const eventIds = await this.redis.smembers(EVENTS_SET_KEY);
    if (!eventIds.length) {
      return;
    }

    const now = Date.now();

    for (const eventId of eventIds) {
      let availableSlots = await this.calculateAvailableSlots(eventId, now);
      if (availableSlots <= 0) {
        continue;
      }

      const candidates = await this.redis.zrange(
        QUEUE_KEY(eventId),
        0,
        availableSlots - 1,
      );
      if (!candidates.length) {
        continue;
      }

      const multi = this.redis.multi();
      for (const ticketId of candidates) {
        const gateToken = randomUUID();
        const expiresAt = now + this.gateTokenTtlMs;
        multi.zrem(QUEUE_KEY(eventId), ticketId);
        multi.hset(TICKET_KEY(ticketId), {
          [TICKET_STATE_FIELD]: 'READY',
          [TICKET_GATE_TOKEN_FIELD]: gateToken,
          [TICKET_EXPIRES_AT_FIELD]: expiresAt.toString(),
        });
        multi.sadd(READY_SET_KEY(eventId), ticketId);
        multi.set(
          GATE_TOKEN_KEY(gateToken),
          ticketId,
          'PX',
          this.gateTokenTtlMs,
        );
        availableSlots -= 1;
        if (availableSlots <= 0) {
          break;
        }
      }
      await multi.exec();
    }
  }

  private async calculateAvailableSlots(
    eventId: string,
    now: number,
  ): Promise<number> {
    const readyKey = READY_SET_KEY(eventId);
    const readyTickets = await this.redis.smembers(readyKey);

    if (readyTickets.length) {
      for (const ticketId of readyTickets) {
        const ticket = await this.redis.hgetall(TICKET_KEY(ticketId));
        if (!ticket || Object.keys(ticket).length === 0) {
          await this.redis.srem(readyKey, ticketId);
          continue;
        }

        if (ticket[TICKET_STATE_FIELD] !== 'READY') {
          await this.redis.srem(readyKey, ticketId);
          continue;
        }

        const expiresAt = Number(ticket[TICKET_EXPIRES_AT_FIELD] ?? 0);
        if (expiresAt && expiresAt <= now) {
          await this.expireTicket(ticketId, ticket);
          await this.redis.srem(readyKey, ticketId);
        }
      }
    }

    const currentReadyCount = await this.redis.scard(readyKey);
    const available = this.readyCapacity - currentReadyCount;
    return available > 0 ? available : 0;
  }

  private async refreshExpiration(
    ticketId: string,
    ticket: Record<string, string>,
  ): Promise<void> {
    const state = ticket[TICKET_STATE_FIELD] as QueueTicketState | undefined;

    if (state === 'READY') {
      const expiresAt = Number(ticket[TICKET_EXPIRES_AT_FIELD] ?? 0);
      if (expiresAt && expiresAt <= Date.now()) {
        await this.expireTicket(ticketId, ticket);
      }
      return;
    }

    if (state === 'USED' || state === 'ORDER_PENDING') {
      const gateToken = ticket[TICKET_GATE_TOKEN_FIELD];
      if (!gateToken) {
        return;
      }
      const ttl = await this.redis.pttl(GATE_TOKEN_KEY(gateToken));
      if (ttl < 0) {
        await this.expireTicket(ticketId, ticket);
      }
    }
  }

  private async expireTicket(
    ticketId: string,
    ticket: Record<string, string>,
  ): Promise<void> {
    const ticketKey = TICKET_KEY(ticketId);
    const multi = this.redis.multi();
    multi.hset(ticketKey, {
      [TICKET_STATE_FIELD]: 'EXPIRED',
    });
    if (ticket[TICKET_GATE_TOKEN_FIELD]) {
      multi.del(GATE_TOKEN_KEY(ticket[TICKET_GATE_TOKEN_FIELD]));
    }
    if (ticket[TICKET_EVENT_FIELD]) {
      multi.srem(READY_SET_KEY(ticket[TICKET_EVENT_FIELD]), ticketId);
    }
    await multi.exec();
  }
}
