import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Event } from '../events/event.entity';
import { User } from '../auth/user.entity';

export enum OrderStatus {
  HOLD = 'HOLD',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
}

@Index('idx_orders_event_status', ['eventId', 'status'])
@Index('idx_orders_user_event', ['userId', 'eventId'])
@Index('idx_orders_idem_key_unique', ['idemKey'], {
  unique: true,
  where: 'idem_key IS NOT NULL',
})
@Entity({ name: 'orders' })
@Check(`"qty" > 0`)
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'event_id', type: 'uuid' })
  eventId: string;

  @Column({ type: 'integer' })
  qty: number;

  @Column({ type: 'enum', enum: OrderStatus })
  status: OrderStatus;

  @Column({ type: 'integer' })
  amount: number;

  @Column({ name: 'idem_key', type: 'text', nullable: true })
  idemKey: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id', referencedColumnName: 'id' })
  user?: User;

  @ManyToOne(() => Event, (event) => event.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'event_id', referencedColumnName: 'id' })
  event?: Event;
}
