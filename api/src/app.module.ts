import { Module } from '@nestjs/common';
import { AuthModule } from './presentation/auth/auth.module';
import { EventsModule } from './presentation/events/events.module';
import { OrdersModule } from './presentation/orders/orders.module';
import { PaymentsModule } from './presentation/payments/payments.module';
import { MonitoringModule } from './presentation/monitoring/monitoring.module';
import { createConfigModule } from './config/create-config-module';
import { createTypeOrmModule } from './config/create-typeorm-module';

@Module({
  imports: [
    createConfigModule(),
    createTypeOrmModule(),
    AuthModule,
    EventsModule,
    OrdersModule,
    PaymentsModule,
    MonitoringModule,
  ],
})
export class AppModule {}
