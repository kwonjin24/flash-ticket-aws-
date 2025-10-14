import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Redis } from 'ioredis';
import { Order } from 'src/domain/orders/entities/order.entity';
import { OrderStatus } from 'src/domain/orders/enums/order-status.enum';
import { Payment } from 'src/domain/payments/entities/payment.entity';
import { PaymentStatus } from 'src/domain/payments/enums/payment-status.enum';
import { REDIS_QUEUE_CLIENT } from 'src/infrastructure/queue/redis.provider';

interface BusinessMetrics {
  // Queue metrics
  queue_waiting_users_total: number;
  queue_ready_users_total: number;
  queue_used_users_total: number;

  // Order metrics
  orders_created_total: number;
  orders_hold_total: number;
  orders_paid_total: number;
  orders_cancelled_total: number;

  // Payment metrics
  payments_pending_total: number;
  payments_successful_total: number;
  payments_failed_total: number;
}

@Injectable()
export class MetricsService {
  constructor(
    @InjectRepository(Order)
    private readonly ordersRepository: Repository<Order>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @Inject(REDIS_QUEUE_CLIENT)
    private readonly redis: Redis,
  ) {}

  async collectMetrics(): Promise<BusinessMetrics> {
    const [queueMetrics, orderMetrics, paymentMetrics] = await Promise.all([
      this.collectQueueMetrics(),
      this.collectOrderMetrics(),
      this.collectPaymentMetrics(),
    ]);

    return {
      ...queueMetrics,
      ...orderMetrics,
      ...paymentMetrics,
    };
  }

  private async collectQueueMetrics(): Promise<{
    queue_waiting_users_total: number;
    queue_ready_users_total: number;
    queue_used_users_total: number;
  }> {
    try {
      // Get all event IDs from the queue events set
      const eventIds = await this.redis.smembers('queue:events');

      let waitingTotal = 0;
      let readyTotal = 0;
      let usedTotal = 0;

      // Aggregate queue metrics across all events
      for (const eventId of eventIds) {
        const queueKey = `queue:event:${eventId}:queue`;
        const readyKey = `queue:event:${eventId}:ready`;

        const [waiting, ready] = await Promise.all([
          this.redis.zcard(queueKey),
          this.redis.scard(readyKey),
        ]);

        waitingTotal += waiting;
        readyTotal += ready;
      }

      // Count tickets in USED state by scanning ticket keys
      const ticketKeys = await this.redis.keys('queue:ticket:*');
      for (const key of ticketKeys) {
        const keyType = await this.redis.type(key);
        if (keyType !== 'hash') {
          continue;
        }
        const ticket = await this.redis.hgetall(key);
        if (ticket.state === 'USED' || ticket.state === 'ORDER_PENDING') {
          usedTotal++;
        }
      }

      return {
        queue_waiting_users_total: waitingTotal,
        queue_ready_users_total: readyTotal,
        queue_used_users_total: usedTotal,
      };
    } catch (error) {
      console.error('Failed to collect queue metrics:', error);
      return {
        queue_waiting_users_total: 0,
        queue_ready_users_total: 0,
        queue_used_users_total: 0,
      };
    }
  }

  private async collectOrderMetrics(): Promise<{
    orders_created_total: number;
    orders_hold_total: number;
    orders_paid_total: number;
    orders_cancelled_total: number;
  }> {
    try {
      const [total, hold, paid, cancelled] = await Promise.all([
        this.ordersRepository.count(),
        this.ordersRepository.count({ where: { status: OrderStatus.HOLD } }),
        this.ordersRepository.count({ where: { status: OrderStatus.PAID } }),
        this.ordersRepository.count({
          where: { status: OrderStatus.CANCELLED },
        }),
      ]);

      return {
        orders_created_total: total,
        orders_hold_total: hold,
        orders_paid_total: paid,
        orders_cancelled_total: cancelled,
      };
    } catch (error) {
      console.error('Failed to collect order metrics:', error);
      return {
        orders_created_total: 0,
        orders_hold_total: 0,
        orders_paid_total: 0,
        orders_cancelled_total: 0,
      };
    }
  }

  private async collectPaymentMetrics(): Promise<{
    payments_pending_total: number;
    payments_successful_total: number;
    payments_failed_total: number;
  }> {
    try {
      const [pending, successful, failed] = await Promise.all([
        this.paymentsRepository.count({
          where: { status: PaymentStatus.REQ },
        }),
        this.paymentsRepository.count({
          where: { status: PaymentStatus.OK },
        }),
        this.paymentsRepository.count({
          where: { status: PaymentStatus.FAIL },
        }),
      ]);

      return {
        payments_pending_total: pending,
        payments_successful_total: successful,
        payments_failed_total: failed,
      };
    } catch (error) {
      console.error('Failed to collect payment metrics:', error);
      return {
        payments_pending_total: 0,
        payments_successful_total: 0,
        payments_failed_total: 0,
      };
    }
  }

  formatPrometheus(metrics: BusinessMetrics): string {
    const lines: string[] = [];

    // Queue metrics
    lines.push(
      '# HELP queue_waiting_users_total Total number of users waiting in queue',
    );
    lines.push('# TYPE queue_waiting_users_total gauge');
    lines.push(
      `queue_waiting_users_total ${metrics.queue_waiting_users_total}`,
    );
    lines.push('');

    lines.push(
      '# HELP queue_ready_users_total Total number of users ready to enter',
    );
    lines.push('# TYPE queue_ready_users_total gauge');
    lines.push(`queue_ready_users_total ${metrics.queue_ready_users_total}`);
    lines.push('');

    lines.push(
      '# HELP queue_used_users_total Total number of users who entered',
    );
    lines.push('# TYPE queue_used_users_total gauge');
    lines.push(`queue_used_users_total ${metrics.queue_used_users_total}`);
    lines.push('');

    // Order metrics
    lines.push('# HELP orders_created_total Total number of orders created');
    lines.push('# TYPE orders_created_total counter');
    lines.push(`orders_created_total ${metrics.orders_created_total}`);
    lines.push('');

    lines.push('# HELP orders_hold_total Total number of orders on hold');
    lines.push('# TYPE orders_hold_total gauge');
    lines.push(`orders_hold_total ${metrics.orders_hold_total}`);
    lines.push('');

    lines.push('# HELP orders_paid_total Total number of paid orders');
    lines.push('# TYPE orders_paid_total counter');
    lines.push(`orders_paid_total ${metrics.orders_paid_total}`);
    lines.push('');

    lines.push(
      '# HELP orders_cancelled_total Total number of cancelled orders',
    );
    lines.push('# TYPE orders_cancelled_total counter');
    lines.push(`orders_cancelled_total ${metrics.orders_cancelled_total}`);
    lines.push('');

    // Payment metrics
    lines.push(
      '# HELP payments_pending_total Total number of pending payments',
    );
    lines.push('# TYPE payments_pending_total gauge');
    lines.push(`payments_pending_total ${metrics.payments_pending_total}`);
    lines.push('');

    lines.push(
      '# HELP payments_successful_total Total number of successful payments',
    );
    lines.push('# TYPE payments_successful_total counter');
    lines.push(
      `payments_successful_total ${metrics.payments_successful_total}`,
    );
    lines.push('');

    lines.push('# HELP payments_failed_total Total number of failed payments');
    lines.push('# TYPE payments_failed_total counter');
    lines.push(`payments_failed_total ${metrics.payments_failed_total}`);
    lines.push('');

    return lines.join('\n');
  }
}
