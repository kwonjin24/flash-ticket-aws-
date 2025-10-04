import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { QueueFacade } from '../../application/queue/services/queue.facade';
import { QueueTicketService } from '../../application/queue/services/queue-ticket.service';
import { QueueGateway } from './gateways/queue.gateway';
import { AuthModule } from '../auth/auth.module';
import { QueueController } from './controllers/queue.controller';
import { redisQueueProvider } from '../../infrastructure/queue/redis.provider';
import { QueuePromotionProcessor } from '../../infrastructure/queue/queue.promotion.processor';

@Module({
  imports: [AuthModule, ConfigModule],
  controllers: [QueueController],
  providers: [
    redisQueueProvider,
    QueueTicketService,
    QueueFacade,
    QueuePromotionProcessor,
    QueueGateway,
  ],
  exports: [QueueTicketService],
})
export class QueueModule {}
