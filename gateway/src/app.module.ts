import { Module } from '@nestjs/common';
import { createConfigModule } from '@api/config/create-config-module';
import { createTypeOrmModule } from '@api/config/create-typeorm-module';
import { QueueModule } from './presentation/queue/queue.module';
import { AuthModule } from './presentation/auth/auth.module';

@Module({
  imports: [
    createConfigModule(),
    createTypeOrmModule({ migrationsRun: false }),
    AuthModule,
    QueueModule,
  ],
})
export class AppModule {}
