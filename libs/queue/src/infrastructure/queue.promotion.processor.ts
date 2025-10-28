import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueTicketService } from '../application/services/queue-ticket.service';
import { REDIS_QUEUE_CLIENT } from './redis.provider';

const PROMOTION_QUEUE = 'queue-ticket-promotion';
const PROMOTION_JOB_ID = 'queue-ticket-promotion-job';
const DEFAULT_PROMOTION_INTERVAL_MS = 3000;

@Injectable()
export class QueuePromotionProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuePromotionProcessor.name);
  private queue!: Queue;
  private worker!: Worker;
  private promotionInterval?: NodeJS.Timeout;
  private readonly promotionIntervalMs: number;

  constructor(
    @Inject(REDIS_QUEUE_CLIENT) private readonly redis: Redis,
    private readonly queueTicketService: QueueTicketService,
    private readonly configService: ConfigService,
  ) {
    this.promotionIntervalMs = Number(
      this.configService.get('QUEUE_PROMOTION_INTERVAL_MS') ?? DEFAULT_PROMOTION_INTERVAL_MS,
    );
  }

  async onModuleInit(): Promise<void> {
    this.logger.log(`[QueuePromotion] Initializing Promotion Service...`);
    this.logger.log(`[QueuePromotion] Promotion interval: ${this.promotionIntervalMs}ms`);

    this.startPromotionInterval();

    this.logger.log(`[QueuePromotion] ✅ Promotion service started`);
  }

  private startPromotionInterval(): void {
    this.promotionInterval = setInterval(async () => {
      try {
        await this.queueTicketService.promoteTickets();
      } catch (error) {
        this.logger.error(`[QueuePromotion] Failed to promote tickets`, error as Error);
      }
    }, this.promotionIntervalMs);
  }

  private async cleanupQueue(nodeEnv: string): Promise<void> {
    try {
      this.logger.log(`[QueuePromotion] Starting background cleanup...`);

      if (nodeEnv !== 'production') {
        this.logger.log(`[QueuePromotion] Obliterating queue for non-production environment`);
        try {
          await this.queue.obliterate({ force: true });
        } catch (error) {
          this.logger.warn(
            `[QueuePromotion] Failed to obliterate queue: ${(error as Error).message}`,
          );
        }
      }

      this.logger.log(`[QueuePromotion] Cleaning up old jobs...`);
      try {
        const repeatables = await this.queue.getRepeatableJobs();
        let removedCount = 0;
        for (const job of repeatables) {
          if (job.name === 'promote' && job.id !== PROMOTION_JOB_ID) {
            await this.queue.removeRepeatableByKey(job.key);
            removedCount++;
          }
        }
        this.logger.log(`[QueuePromotion] Removed ${removedCount} old promotion jobs`);
      } catch (error) {
        this.logger.warn(`[QueuePromotion] Failed to remove old jobs: ${(error as Error).message}`);
      }

      try {
        await this.queue.clean(0, 1000, 'completed');
        await this.queue.clean(0, 1000, 'failed');
        this.logger.log(`[QueuePromotion] ✅ Queue cleanup completed`);
      } catch (error) {
        this.logger.warn(`[QueuePromotion] Failed to clean queue: ${(error as Error).message}`);
      }
    } catch (error) {
      this.logger.error(`[QueuePromotion] Cleanup failed`, error as Error);
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.logger.log(`[QueuePromotion] Shutting down promotion service...`);

    if (this.promotionInterval) {
      clearInterval(this.promotionInterval);
      this.promotionInterval = undefined;
    }

    this.logger.log(`[QueuePromotion] ✅ Promotion service shut down`);
  }
}
