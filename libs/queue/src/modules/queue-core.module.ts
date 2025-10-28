import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueFacade } from '../application/services/queue.facade';
import { QueueTicketService } from '../application/services/queue-ticket.service';
import { redisQueueProvider } from '../infrastructure/redis.provider';

@Module({
  imports: [ConfigModule],
  providers: [redisQueueProvider, QueueTicketService, QueueFacade],
  exports: [redisQueueProvider, QueueTicketService, QueueFacade],
})
export class QueueCoreModule {}
