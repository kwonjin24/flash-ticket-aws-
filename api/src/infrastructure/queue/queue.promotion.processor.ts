import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
    const existingJob = await this.queue.getJob(PROMOTION_JOB_ID);
    if (!existingJob) {
      await this.queue.add('promote', {}, {
        jobId: PROMOTION_JOB_ID,
        repeat: {
          every: repeatEvery,
        },
      });
    }
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
