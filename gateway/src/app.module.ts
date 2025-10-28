import { Module } from '@nestjs/common';
import { createConfigModule } from '@api/config/create-config-module';
import { createTypeOrmModule } from '@api/config/create-typeorm-module';
import { AuthModule } from './presentation/auth/auth.module';
import { QueueModule } from './presentation/queue/queue.module';
import { MonitoringModule } from './presentation/monitoring/monitoring.module';

@Module({
  imports: [
    createConfigModule(),
    createTypeOrmModule({ migrationsRun: false }),
    AuthModule,
    QueueModule,
    MonitoringModule,
  ],
})
export class AppModule {}
