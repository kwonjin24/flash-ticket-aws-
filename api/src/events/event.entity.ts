import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Order } from '../orders/order.entity';

export enum EventStatus {
  DRAFT = 'DRAFT',
  ONSALE = 'ONSALE',
  CLOSED = 'CLOSED',
}

@Entity({ name: 'events' })
export class Event {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ name: 'starts_at', type: 'timestamptz' })
  startsAt: Date;

  @Column({ name: 'ends_at', type: 'timestamptz' })
  endsAt: Date;

  @Column({ name: 'total_qty', type: 'integer' })
  totalQty: number;

  @Column({ name: 'sold_qty', type: 'integer', default: 0 })
  soldQty: number;

  @Column({ name: 'max_per_user', type: 'integer' })
  maxPerUser: number;

  @Column({ type: 'integer' })
  price: number;

  @Column({ type: 'enum', enum: EventStatus, default: EventStatus.DRAFT })
  status: EventStatus;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => Order, (order) => order.event)
  orders?: Order[];
}
