import {
  Inject,
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Queue, Worker } from 'bullmq';
import { Redis } from 'ioredis';
import { QueueTicketService } from '../../application/queue/services/queue-ticket.service';
import { REDIS_QUEUE_CLIENT } from './redis.provider';

const PROMOTION_QUEUE = 'queue-ticket-promotion';
const PROMOTION_JOB_ID = 'queue-ticket-promotion-job';

@Injectable()
export class QueuePromotionProcessor implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueuePromotionProcessor.name);
  private queue!: Queue;
  private worker!: Worker;

  constructor(
    @Inject(REDIS_QUEUE_CLIENT) private readonly redis: Redis,
    private readonly queueTicketService: QueueTicketService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.queue = new Queue(PROMOTION_QUEUE, {
      connection: this.redis.duplicate(),
    });

    this.worker = new Worker(
      PROMOTION_QUEUE,
      async () => {
        try {
          await this.queueTicketService.promoteTickets();
        } catch (error) {
          this.logger.error('Failed to promote tickets', error as Error);
          throw error;
        }
      },
      {
        autorun: true,
        connection: this.redis.duplicate(),
      },
    );

    const repeatEvery = this.queueTicketService.getPromotionIntervalMs();
    const nodeEnv = process.env.NODE_ENV ?? 'local';

    if (nodeEnv !== 'production') {
      try {
        await this.queue.obliterate({ force: true });
      } catch (error) {
        this.logger.warn(
          `Failed to obliterate queue during init: ${(error as Error).message}`,
        );
      }
    }

    const repeatables = await this.queue.getRepeatableJobs();
    // Remove stale repeat schedules so we always have exactly one job
    for (const job of repeatables) {
      if (job.name === 'promote') {
        await this.queue.removeRepeatableByKey(job.key);
      }
    }
    // Clear any lingering jobs that were scheduled with the old cadence
    await this.queue.drain(true);
    await this.queue.clean(0, 1000, 'completed');
    await this.queue.clean(0, 1000, 'failed');

    await this.queue.add(
      'promote',
      {},
      {
        jobId: PROMOTION_JOB_ID,
        repeat: {
          every: repeatEvery,
        },
        removeOnComplete: true,
        removeOnFail: true,
      },
    );
  }

  async onModuleDestroy(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
  }
}
