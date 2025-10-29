import { Module } from '@nestjs/common';
import { QueueCoreModule } from '@queue/modules/queue-core.module';
import { MetricsController } from './controllers/metrics.controller';
import { LiveController } from './controllers/live.controller';

@Module({
  imports: [QueueCoreModule],
  controllers: [MetricsController, LiveController],
})
export class MonitoringModule {}
