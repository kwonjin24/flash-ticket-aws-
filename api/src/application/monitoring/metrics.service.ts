import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository, InjectDataSource } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { Order } from 'src/domain/orders/entities/order.entity';
import { OrderStatus } from 'src/domain/orders/enums/order-status.enum';
import { Payment } from 'src/domain/payments/entities/payment.entity';
import { PaymentStatus } from 'src/domain/payments/enums/payment-status.enum';
import { REDIS_QUEUE_CLIENT } from '@queue/infrastructure/redis.provider';

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
  orders_failed_total: number;

  // Payment metrics
  payments_pending_total: number;
  payments_successful_total: number;
  payments_failed_total: number;

  // Database metrics
  db_connections_active: number;
  db_transactions_committed_total: number;
  db_transactions_rolled_back_total: number;
  db_blocks_read_total: number;
  db_blocks_hit_total: number;
  db_rows_returned_total: number;
  db_rows_fetched_total: number;
  db_rows_inserted_total: number;
  db_rows_updated_total: number;
  db_rows_deleted_total: number;
  db_conflicts_total: number;
  db_temp_files_total: number;
  db_temp_bytes_total: number;
  db_block_read_time_ms_total: number;
  db_block_write_time_ms_total: number;
  db_bgwriter_checkpoints_timed_total: number;
  db_bgwriter_checkpoints_requested_total: number;
  db_bgwriter_checkpoint_write_time_ms_total: number;
  db_bgwriter_checkpoint_sync_time_ms_total: number;
  db_bgwriter_buffers_checkpoint_total: number;
  db_bgwriter_buffers_clean_total: number;
  db_bgwriter_maxwritten_clean_total: number;
  db_bgwriter_buffers_backend_total: number;
  db_bgwriter_buffers_backend_fsync_total: number;
  db_bgwriter_buffers_alloc_total: number;
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
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  async collectMetrics(): Promise<BusinessMetrics> {
    const [queueMetrics, orderMetrics, paymentMetrics, databaseMetrics] = await Promise.all([
      this.collectQueueMetrics(),
      this.collectOrderMetrics(),
      this.collectPaymentMetrics(),
      this.collectDatabaseMetrics(),
    ]);

    return {
      ...queueMetrics,
      ...orderMetrics,
      ...paymentMetrics,
      ...databaseMetrics,
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
    orders_failed_total: number;
  }> {
    try {
      const [total, hold, paid, cancelled, failed] = await Promise.all([
        this.ordersRepository.count(),
        this.ordersRepository.count({ where: { status: OrderStatus.HOLD } }),
        this.ordersRepository.count({ where: { status: OrderStatus.PAID } }),
        this.ordersRepository.count({
          where: { status: OrderStatus.CANCELLED },
        }),
        this.ordersRepository.count({
          where: { status: OrderStatus.FAIL },
        }),
      ]);

      return {
        orders_created_total: total,
        orders_hold_total: hold,
        orders_paid_total: paid,
        orders_cancelled_total: cancelled,
        orders_failed_total: failed,
      };
    } catch (error) {
      console.error('Failed to collect order metrics:', error);
      return {
        orders_created_total: 0,
        orders_hold_total: 0,
        orders_paid_total: 0,
        orders_cancelled_total: 0,
        orders_failed_total: 0,
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

  private async collectDatabaseMetrics(): Promise<{
    db_connections_active: number;
    db_transactions_committed_total: number;
    db_transactions_rolled_back_total: number;
    db_blocks_read_total: number;
    db_blocks_hit_total: number;
    db_rows_returned_total: number;
    db_rows_fetched_total: number;
    db_rows_inserted_total: number;
    db_rows_updated_total: number;
    db_rows_deleted_total: number;
    db_conflicts_total: number;
    db_temp_files_total: number;
    db_temp_bytes_total: number;
    db_block_read_time_ms_total: number;
    db_block_write_time_ms_total: number;
    db_bgwriter_checkpoints_timed_total: number;
    db_bgwriter_checkpoints_requested_total: number;
    db_bgwriter_checkpoint_write_time_ms_total: number;
    db_bgwriter_checkpoint_sync_time_ms_total: number;
    db_bgwriter_buffers_checkpoint_total: number;
    db_bgwriter_buffers_clean_total: number;
    db_bgwriter_maxwritten_clean_total: number;
    db_bgwriter_buffers_backend_total: number;
    db_bgwriter_buffers_backend_fsync_total: number;
    db_bgwriter_buffers_alloc_total: number;
  }> {
    try {
      const [databaseRow] = await this.dataSource.query(
        `
        SELECT
          COALESCE(numbackends, 0) AS numbackends,
          COALESCE(xact_commit, 0) AS xact_commit,
          COALESCE(xact_rollback, 0) AS xact_rollback,
          COALESCE(blks_read, 0) AS blks_read,
          COALESCE(blks_hit, 0) AS blks_hit,
          COALESCE(tup_returned, 0) AS tup_returned,
          COALESCE(tup_fetched, 0) AS tup_fetched,
          COALESCE(tup_inserted, 0) AS tup_inserted,
          COALESCE(tup_updated, 0) AS tup_updated,
          COALESCE(tup_deleted, 0) AS tup_deleted,
          COALESCE(conflicts, 0) AS conflicts,
          COALESCE(temp_files, 0) AS temp_files,
          COALESCE(temp_bytes, 0) AS temp_bytes,
          COALESCE(blk_read_time, 0) AS blk_read_time,
          COALESCE(blk_write_time, 0) AS blk_write_time
        FROM pg_stat_database
        WHERE datname = current_database()
      `,
      );

      const [bgwriterRow] = await this.dataSource.query(
        `
        SELECT
          COALESCE(checkpoints_timed, 0) AS checkpoints_timed,
          COALESCE(checkpoints_req, 0) AS checkpoints_req,
          COALESCE(checkpoint_write_time, 0) AS checkpoint_write_time,
          COALESCE(checkpoint_sync_time, 0) AS checkpoint_sync_time,
          COALESCE(buffers_checkpoint, 0) AS buffers_checkpoint,
          COALESCE(buffers_clean, 0) AS buffers_clean,
          COALESCE(maxwritten_clean, 0) AS maxwritten_clean,
          COALESCE(buffers_backend, 0) AS buffers_backend,
          COALESCE(buffers_backend_fsync, 0) AS buffers_backend_fsync,
          COALESCE(buffers_alloc, 0) AS buffers_alloc
        FROM pg_stat_bgwriter
      `,
      );

      const pick = (value: unknown): number => {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
      };

      return {
        db_connections_active: pick(databaseRow?.numbackends),
        db_transactions_committed_total: pick(databaseRow?.xact_commit),
        db_transactions_rolled_back_total: pick(databaseRow?.xact_rollback),
        db_blocks_read_total: pick(databaseRow?.blks_read),
        db_blocks_hit_total: pick(databaseRow?.blks_hit),
        db_rows_returned_total: pick(databaseRow?.tup_returned),
        db_rows_fetched_total: pick(databaseRow?.tup_fetched),
        db_rows_inserted_total: pick(databaseRow?.tup_inserted),
        db_rows_updated_total: pick(databaseRow?.tup_updated),
        db_rows_deleted_total: pick(databaseRow?.tup_deleted),
        db_conflicts_total: pick(databaseRow?.conflicts),
        db_temp_files_total: pick(databaseRow?.temp_files),
        db_temp_bytes_total: pick(databaseRow?.temp_bytes),
        db_block_read_time_ms_total: pick(databaseRow?.blk_read_time),
        db_block_write_time_ms_total: pick(databaseRow?.blk_write_time),
        db_bgwriter_checkpoints_timed_total: pick(bgwriterRow?.checkpoints_timed),
        db_bgwriter_checkpoints_requested_total: pick(bgwriterRow?.checkpoints_req),
        db_bgwriter_checkpoint_write_time_ms_total: pick(bgwriterRow?.checkpoint_write_time),
        db_bgwriter_checkpoint_sync_time_ms_total: pick(bgwriterRow?.checkpoint_sync_time),
        db_bgwriter_buffers_checkpoint_total: pick(bgwriterRow?.buffers_checkpoint),
        db_bgwriter_buffers_clean_total: pick(bgwriterRow?.buffers_clean),
        db_bgwriter_maxwritten_clean_total: pick(bgwriterRow?.maxwritten_clean),
        db_bgwriter_buffers_backend_total: pick(bgwriterRow?.buffers_backend),
        db_bgwriter_buffers_backend_fsync_total: pick(bgwriterRow?.buffers_backend_fsync),
        db_bgwriter_buffers_alloc_total: pick(bgwriterRow?.buffers_alloc),
      };
    } catch (error) {
      console.error('Failed to collect database metrics:', error);
      return {
        db_connections_active: 0,
        db_transactions_committed_total: 0,
        db_transactions_rolled_back_total: 0,
        db_blocks_read_total: 0,
        db_blocks_hit_total: 0,
        db_rows_returned_total: 0,
        db_rows_fetched_total: 0,
        db_rows_inserted_total: 0,
        db_rows_updated_total: 0,
        db_rows_deleted_total: 0,
        db_conflicts_total: 0,
        db_temp_files_total: 0,
        db_temp_bytes_total: 0,
        db_block_read_time_ms_total: 0,
        db_block_write_time_ms_total: 0,
        db_bgwriter_checkpoints_timed_total: 0,
        db_bgwriter_checkpoints_requested_total: 0,
        db_bgwriter_checkpoint_write_time_ms_total: 0,
        db_bgwriter_checkpoint_sync_time_ms_total: 0,
        db_bgwriter_buffers_checkpoint_total: 0,
        db_bgwriter_buffers_clean_total: 0,
        db_bgwriter_maxwritten_clean_total: 0,
        db_bgwriter_buffers_backend_total: 0,
        db_bgwriter_buffers_backend_fsync_total: 0,
        db_bgwriter_buffers_alloc_total: 0,
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

    lines.push('# HELP orders_failed_total Total number of failed orders');
    lines.push('# TYPE orders_failed_total counter');
    lines.push(`orders_failed_total ${metrics.orders_failed_total}`);
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

    // Database metrics
    lines.push('# HELP db_connections_active Current number of active database connections');
    lines.push('# TYPE db_connections_active gauge');
    lines.push(`db_connections_active ${metrics.db_connections_active}`);
    lines.push('');

    lines.push('# HELP db_transactions_committed_total Total transactions committed since last reset');
    lines.push('# TYPE db_transactions_committed_total counter');
    lines.push(
      `db_transactions_committed_total ${metrics.db_transactions_committed_total}`,
    );
    lines.push('');

    lines.push('# HELP db_transactions_rolled_back_total Total transactions rolled back since last reset');
    lines.push('# TYPE db_transactions_rolled_back_total counter');
    lines.push(
      `db_transactions_rolled_back_total ${metrics.db_transactions_rolled_back_total}`,
    );
    lines.push('');

    lines.push('# HELP db_blocks_read_total Total blocks read from disk since last reset');
    lines.push('# TYPE db_blocks_read_total counter');
    lines.push(`db_blocks_read_total ${metrics.db_blocks_read_total}`);
    lines.push('');

    lines.push('# HELP db_blocks_hit_total Total blocks served from cache since last reset');
    lines.push('# TYPE db_blocks_hit_total counter');
    lines.push(`db_blocks_hit_total ${metrics.db_blocks_hit_total}`);
    lines.push('');

    lines.push('# HELP db_block_read_time_ms_total Time spent reading blocks from disk since last reset (milliseconds)');
    lines.push('# TYPE db_block_read_time_ms_total counter');
    lines.push(`db_block_read_time_ms_total ${metrics.db_block_read_time_ms_total}`);
    lines.push('');

    lines.push('# HELP db_block_write_time_ms_total Time spent writing blocks to disk since last reset (milliseconds)');
    lines.push('# TYPE db_block_write_time_ms_total counter');
    lines.push(`db_block_write_time_ms_total ${metrics.db_block_write_time_ms_total}`);
    lines.push('');

    lines.push('# HELP db_rows_returned_total Total rows returned by queries since last reset');
    lines.push('# TYPE db_rows_returned_total counter');
    lines.push(`db_rows_returned_total ${metrics.db_rows_returned_total}`);
    lines.push('');

    lines.push('# HELP db_rows_fetched_total Total rows fetched by queries since last reset');
    lines.push('# TYPE db_rows_fetched_total counter');
    lines.push(`db_rows_fetched_total ${metrics.db_rows_fetched_total}`);
    lines.push('');

    lines.push('# HELP db_rows_inserted_total Total rows inserted since last reset');
    lines.push('# TYPE db_rows_inserted_total counter');
    lines.push(`db_rows_inserted_total ${metrics.db_rows_inserted_total}`);
    lines.push('');

    lines.push('# HELP db_rows_updated_total Total rows updated since last reset');
    lines.push('# TYPE db_rows_updated_total counter');
    lines.push(`db_rows_updated_total ${metrics.db_rows_updated_total}`);
    lines.push('');

    lines.push('# HELP db_rows_deleted_total Total rows deleted since last reset');
    lines.push('# TYPE db_rows_deleted_total counter');
    lines.push(`db_rows_deleted_total ${metrics.db_rows_deleted_total}`);
    lines.push('');

    lines.push('# HELP db_conflicts_total Total number of query conflicts since last reset');
    lines.push('# TYPE db_conflicts_total counter');
    lines.push(`db_conflicts_total ${metrics.db_conflicts_total}`);
    lines.push('');

    lines.push('# HELP db_temp_files_total Total temporary files created since last reset');
    lines.push('# TYPE db_temp_files_total counter');
    lines.push(`db_temp_files_total ${metrics.db_temp_files_total}`);
    lines.push('');

    lines.push('# HELP db_temp_bytes_total Total bytes written to temporary files since last reset');
    lines.push('# TYPE db_temp_bytes_total counter');
    lines.push(`db_temp_bytes_total ${metrics.db_temp_bytes_total}`);
    lines.push('');

    lines.push('# HELP db_bgwriter_checkpoints_timed_total Total timed checkpoints triggered since last reset');
    lines.push('# TYPE db_bgwriter_checkpoints_timed_total counter');
    lines.push(
      `db_bgwriter_checkpoints_timed_total ${metrics.db_bgwriter_checkpoints_timed_total}`,
    );
    lines.push('');

    lines.push('# HELP db_bgwriter_checkpoints_requested_total Total requested checkpoints triggered since last reset');
    lines.push('# TYPE db_bgwriter_checkpoints_requested_total counter');
    lines.push(
      `db_bgwriter_checkpoints_requested_total ${metrics.db_bgwriter_checkpoints_requested_total}`,
    );
    lines.push('');

    lines.push('# HELP db_bgwriter_checkpoint_write_time_ms_total Total time spent writing checkpoints since last reset (milliseconds)');
    lines.push('# TYPE db_bgwriter_checkpoint_write_time_ms_total counter');
    lines.push(
      `db_bgwriter_checkpoint_write_time_ms_total ${metrics.db_bgwriter_checkpoint_write_time_ms_total}`,
    );
    lines.push('');

    lines.push('# HELP db_bgwriter_checkpoint_sync_time_ms_total Total time spent syncing checkpoints since last reset (milliseconds)');
    lines.push('# TYPE db_bgwriter_checkpoint_sync_time_ms_total counter');
    lines.push(
      `db_bgwriter_checkpoint_sync_time_ms_total ${metrics.db_bgwriter_checkpoint_sync_time_ms_total}`,
    );
    lines.push('');

    lines.push('# HELP db_bgwriter_buffers_checkpoint_total Buffers written during checkpoints since last reset');
    lines.push('# TYPE db_bgwriter_buffers_checkpoint_total counter');
    lines.push(
      `db_bgwriter_buffers_checkpoint_total ${metrics.db_bgwriter_buffers_checkpoint_total}`,
    );
    lines.push('');

    lines.push('# HELP db_bgwriter_buffers_clean_total Buffers written by the background writer since last reset');
    lines.push('# TYPE db_bgwriter_buffers_clean_total counter');
    lines.push(`db_bgwriter_buffers_clean_total ${metrics.db_bgwriter_buffers_clean_total}`);
    lines.push('');

    lines.push('# HELP db_bgwriter_maxwritten_clean_total Number of times the background writer stopped a cleaning scan because it had written too many buffers');
    lines.push('# TYPE db_bgwriter_maxwritten_clean_total counter');
    lines.push(
      `db_bgwriter_maxwritten_clean_total ${metrics.db_bgwriter_maxwritten_clean_total}`,
    );
    lines.push('');

    lines.push('# HELP db_bgwriter_buffers_backend_total Buffers written directly by backend processes since last reset');
    lines.push('# TYPE db_bgwriter_buffers_backend_total counter');
    lines.push(`db_bgwriter_buffers_backend_total ${metrics.db_bgwriter_buffers_backend_total}`);
    lines.push('');

    lines.push('# HELP db_bgwriter_buffers_backend_fsync_total Number of backend fsync calls since last reset');
    lines.push('# TYPE db_bgwriter_buffers_backend_fsync_total counter');
    lines.push(
      `db_bgwriter_buffers_backend_fsync_total ${metrics.db_bgwriter_buffers_backend_fsync_total}`,
    );
    lines.push('');

    lines.push('# HELP db_bgwriter_buffers_alloc_total Total buffers allocated since last reset');
    lines.push('# TYPE db_bgwriter_buffers_alloc_total counter');
    lines.push(`db_bgwriter_buffers_alloc_total ${metrics.db_bgwriter_buffers_alloc_total}`);
    lines.push('');

    return lines.join('\n');
  }
}
