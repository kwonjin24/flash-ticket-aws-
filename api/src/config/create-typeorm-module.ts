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
      const databaseUrl = configService.getOrThrow<string>('DATABASE_URL');
      const nodeEnv = configService.get<string>('NODE_ENV') ?? 'local';
      const dbSslMode = configService.get<string>('DATABASE_SSL_MODE') ?? 'require';

      console.log(`[Database] Initializing TypeORM connection to PostgreSQL`);
      console.log(`[Database] NODE_ENV: ${nodeEnv}`);
      console.log(`[Database] SSL Mode: ${dbSslMode}`);
      console.log(`[Database] Connection timeout: 10000ms`);
      console.log(`[Database] Acquiring connection pool...`);

      const base: PostgresConnectionOptions = {
        type: 'postgres',
        url: databaseUrl,
        entities,
        migrations: ['dist/migrations/*.js'],
        synchronize: false,
        migrationsRun: true,
        logging: nodeEnv !== 'production',
        // Additional options for connection
        extra: {
          // Connection pool settings
          max: 20,
          min: 2,
          idleTimeoutMillis: 30000,
          connectionTimeoutMillis: 10000,
          // TCP keepalive
          statement_timeout: 30000,
          // Connection validation query
          application_name: 'flash-tickets-gateway',
          // SSL/TLS settings
          ssl: dbSslMode === 'disable' ? false : {
            rejectUnauthorized: dbSslMode === 'require' ? false : true,
          },
        },
      };

      const options: PostgresConnectionOptions = {
        ...base,
        ...overrides,
        url: overrides.url ?? base.url,
        entities: overrides.entities ?? base.entities,
      };

      console.log(`[Database] TypeORM options configured successfully`);

      return options;
    },
  });
}
