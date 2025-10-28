import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { Redis } from 'ioredis';
import { QueueTicketService } from '../application/services/queue-ticket.service';
import { REDIS_QUEUE_CLIENT } from './redis.provider';

const DEFAULT_PROMOTION_INTERVAL_MS = 3000;
const DEFAULT_LOCK_TTL_MULTIPLIER = 3;
const MIN_LOCK_TTL_MS = 10_000;

@Injectable()
export class QueuePromotionProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuePromotionProcessor.name);
  private promotionInterval?: NodeJS.Timeout;
  private readonly promotionIntervalMs: number;
  private readonly lockKey = 'queue:promotion:lock';
  private readonly lockTtlMs: number;
  private readonly lockId = randomUUID();
  private isLeader = false;

  constructor(
    @Inject(REDIS_QUEUE_CLIENT) private readonly redis: Redis,
    private readonly queueTicketService: QueueTicketService,
    private readonly configService: ConfigService,
  ) {
    this.promotionIntervalMs = Number(
      this.configService.get('QUEUE_PROMOTION_INTERVAL_MS') ?? DEFAULT_PROMOTION_INTERVAL_MS,
    );
    const requestedLockTtlMs = this.promotionIntervalMs * DEFAULT_LOCK_TTL_MULTIPLIER;
    this.lockTtlMs = Math.max(requestedLockTtlMs, MIN_LOCK_TTL_MS);
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`[QueuePromotion] Initializing Promotion Service...`);
    this.logger.log(`[QueuePromotion] Promotion interval: ${this.promotionIntervalMs}ms`);
    this.logger.log(
      `[QueuePromotion] Leader lock TTL: ${this.lockTtlMs}ms (id=${this.lockId})`,
    );

    this.startPromotionInterval();

    this.logger.log(`[QueuePromotion] ✅ Promotion service started`);
  }

  private startPromotionInterval(): void {
    this.promotionInterval = setInterval(async () => {
      try {
        const hasLeadership = await this.acquireOrRefreshLeadership();
        if (!hasLeadership) {
          return;
        }

        await this.queueTicketService.promoteTickets();

        // Renew the lock after the work to keep TTL fresh even on longer promotions.
        await this.refreshLeadership();
      } catch (error) {
        this.logger.error(`[QueuePromotion] Failed to promote tickets`, error as Error);
      }
    }, this.promotionIntervalMs);
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(`[QueuePromotion] Shutting down promotion service...`);

    if (this.promotionInterval) {
      clearInterval(this.promotionInterval);
      this.promotionInterval = undefined;
    }

    await this.releaseLeadership();

    this.logger.log(`[QueuePromotion] ✅ Promotion service shut down`);
  }

  private async acquireOrRefreshLeadership(): Promise<boolean> {
    try {
      if (!this.isLeader) {
        const result = await this.redis.set(
          this.lockKey,
          this.lockId,
          'PX',
          this.lockTtlMs,
          'NX',
        );
        if (result === 'OK') {
          this.isLeader = true;
          this.logger.log(`[QueuePromotion] Acquired promotion lock (id=${this.lockId})`);
          return true;
        }

        return false;
      }

      return await this.refreshLeadership();
    } catch (error) {
      this.logger.warn(
        `[QueuePromotion] Failed to acquire promotion lock: ${(error as Error).message}`,
      );
      this.isLeader = false;
      return false;
    }
  }

  private async refreshLeadership(): Promise<boolean> {
    if (!this.isLeader) {
      return false;
    }

    try {
      const result = await this.redis.eval(
        `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("pexpire", KEYS[1], ARGV[2])
        else
          return 0
        end
      `,
        1,
        this.lockKey,
        this.lockId,
        this.lockTtlMs,
      );

      if (result === 1 || result === '1') {
        return true;
      }

      if (this.isLeader) {
        this.logger.warn(
          `[QueuePromotion] Lost promotion lock to another pod, will retry acquisition`,
        );
      }
      this.isLeader = false;
      return false;
    } catch (error) {
      this.logger.warn(
        `[QueuePromotion] Failed to refresh promotion lock: ${(error as Error).message}`,
      );
      this.isLeader = false;
      return false;
    }
  }

  private async releaseLeadership(): Promise<void> {
    try {
      await this.redis.eval(
        `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `,
        1,
        this.lockKey,
        this.lockId,
      );
    } catch (error) {
      this.logger.warn(
        `[QueuePromotion] Failed to release promotion lock: ${(error as Error).message}`,
      );
    } finally {
      this.isLeader = false;
    }
  }
}
