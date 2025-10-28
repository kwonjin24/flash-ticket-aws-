import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueCoreModule } from '@queue/modules/queue-core.module';
import { QueuePromotionProcessor } from '@queue/infrastructure/queue.promotion.processor';
import { QueueController } from './controllers/queue.controller';
import { QueueGateway } from './gateways/queue.gateway';

@Module({
  imports: [AuthModule, QueueCoreModule],
  controllers: [QueueController],
  providers: [QueuePromotionProcessor, QueueGateway],
})
export class QueueModule {}
