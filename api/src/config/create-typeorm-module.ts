import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions';
import { User } from '../domain/auth/entities/user.entity';
import { Event } from '../domain/events/entities/event.entity';
import { Order } from '../domain/orders/entities/order.entity';
import { Payment } from '../domain/payments/entities/payment.entity';

export function createTypeOrmModule(
  overrides: Partial<PostgresConnectionOptions> = {},
) {
  const entities = [User, Event, Order, Payment];

  return TypeOrmModule.forRootAsync({
    imports: [ConfigModule],
    inject: [ConfigService],
    useFactory: (configService: ConfigService) => {
      const base: PostgresConnectionOptions = {
        type: 'postgres',
        url: configService.getOrThrow<string>('DATABASE_URL'),
        entities,
        migrations: ['dist/migrations/*.js'],
        synchronize: false,
        migrationsRun: true,
        logging: configService.get<string>('NODE_ENV') !== 'production',
      };

      const options: PostgresConnectionOptions = {
        ...base,
        ...overrides,
        url: overrides.url ?? base.url,
        entities: overrides.entities ?? base.entities,
      };

      return options;
    },
  });
}
