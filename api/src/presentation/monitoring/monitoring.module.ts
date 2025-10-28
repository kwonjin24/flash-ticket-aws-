import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../domain/orders/entities/order.entity';
import { Payment } from '../../domain/payments/entities/payment.entity';
import { HealthController } from './controllers/health.controller';
import { LiveController } from './controllers/live.controller';
import { MetricsController } from './controllers/metrics.controller';
import { MetricsService } from '../../application/monitoring/metrics.service';
import { HealthService } from '../../application/monitoring/health.service';
import { QueueCoreModule } from '@queue/modules/queue-core.module';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Payment]), QueueCoreModule],
  controllers: [MetricsController, HealthController, LiveController],
  providers: [MetricsService, HealthService],
})
export class MonitoringModule {}
