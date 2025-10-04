import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { join } from 'node:path';
import { User } from './domain/auth/entities/user.entity';
import { Event } from './domain/events/entities/event.entity';
import { Order } from './domain/orders/entities/order.entity';
import { Payment } from './domain/payments/entities/payment.entity';
import { AuthModule } from './presentation/auth/auth.module';
import { EventsModule } from './presentation/events/events.module';
import { OrdersModule } from './presentation/orders/orders.module';
import { QueueModule } from './presentation/queue/queue.module';
import { PaymentsModule } from './presentation/payments/payments.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: (() => {
        const env = process.env.NODE_ENV ?? 'local';
        const candidates = [
          `.env.${env}.local`,
          `.env.${env}`,
          '.env.local',
          '.env',
        ];
        const directories = new Set<string>([
          process.cwd(),
          __dirname,
          join(__dirname, '..'),
          join(__dirname, '..', '..'),
        ]);
        const resolved = new Set<string>();
        for (const dir of directories) {
          for (const base of candidates) {
            resolved.add(join(dir, base));
          }
        }
        return Array.from(resolved);
      })(),
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities: [User, Event, Order, Payment],
        migrations: ['dist/migrations/*.js'],
        synchronize: false,
        migrationsRun: true,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),
    AuthModule,
    EventsModule,
    OrdersModule,
    QueueModule,
    PaymentsModule,
  ],
})
export class AppModule {}
