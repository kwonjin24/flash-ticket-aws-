import { config } from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { DataSource, DataSourceOptions } from 'typeorm';
import { Event } from '../events/event.entity';
import { Order } from '../orders/order.entity';
import { User } from '../auth/user.entity';

const envCandidates = [
  resolve(__dirname, '../../../.env'),
  resolve(__dirname, '../../.env'),
  resolve(__dirname, '../.env'),
  resolve(__dirname, '.env'),
];

for (const filePath of envCandidates) {
  if (existsSync(filePath)) {
    config({ path: filePath, override: true });
  }
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
