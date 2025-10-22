import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Event } from '../../domain/events/entities/event.entity';
import { Order } from '../../domain/orders/entities/order.entity';
import { User } from '../../domain/auth/entities/user.entity';

const shouldLoadEnvFiles =
  (process.env.LOAD_ENV_FILES ?? 'true').toLowerCase() !== 'false';

if (shouldLoadEnvFiles) {
  if (process.env.NODE_ENV !== 'test') {
    console.info('[TypeORM] Loading environment files as fallback');
  }
  const envCandidates = [
    resolve(__dirname, '../../../../.env'),
    resolve(__dirname, '../../../.env'),
    resolve(__dirname, '../../.env'),
    resolve(__dirname, '../.env'),
  ];

  for (const filePath of envCandidates) {
    if (existsSync(filePath)) {
      config({ path: filePath, override: true });
    }
  }
} else if (process.env.NODE_ENV !== 'test') {
  console.info(
    '[TypeORM] LOAD_ENV_FILES=false, using runtime environment variables only',
  );
}

export const dataSourceOptions: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User, Event, Order],
  migrations: ['dist/migrations/*.js'],
  synchronize: false,
  migrationsRun: true,
  logging: process.env.NODE_ENV !== 'production',
};

export const AppDataSource = new DataSource(dataSourceOptions);

export default AppDataSource;
