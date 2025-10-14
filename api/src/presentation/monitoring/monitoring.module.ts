import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Order } from '../../domain/orders/entities/order.entity';
import { Payment } from '../../domain/payments/entities/payment.entity';
import { redisQueueProvider } from '../../infrastructure/queue/redis.provider';
import { MetricsController } from './controllers/metrics.controller';
import { HealthController } from './controllers/health.controller';
import { MetricsService } from '../../application/monitoring/metrics.service';
import { HealthService } from '../../application/monitoring/health.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order, Payment])],
  controllers: [MetricsController, HealthController],
  providers: [MetricsService, HealthService, redisQueueProvider],
})
export class MonitoringModule {}
