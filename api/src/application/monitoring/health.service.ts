import { Inject, Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Redis } from 'ioredis';
import { REDIS_QUEUE_CLIENT } from '@queue/infrastructure/redis.provider';

export interface HealthCheckResult {
  status: 'ok' | 'error';
  timestamp: string;
  uptime: number;
  checks: {
    database: {
      status: 'up' | 'down';
      responseTime?: number;
    };
    redis: {
      status: 'up' | 'down';
      responseTime?: number;
    };
  };
}

const isHealthVerbose =
  (process.env.API_HEALTH_LOG_LEVEL ?? '').toLowerCase() === 'debug';

const logVerbose = (message: string, ...optionalParams: unknown[]) => {
  if (isHealthVerbose) {
    console.log(message, ...optionalParams);
  }
};

@Injectable()
export class HealthService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @Inject(REDIS_QUEUE_CLIENT)
    private readonly redis: Redis,
  ) {}

  async check(): Promise<HealthCheckResult> {
    logVerbose('[HealthCheck] Starting health check...');

    const [dbCheck, redisCheck] = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const allHealthy = dbCheck.status === 'up' && redisCheck.status === 'up';

    if (!allHealthy || isHealthVerbose) {
      console.log('[HealthCheck] Health check completed', {
        database: dbCheck.status,
        redis: redisCheck.status,
        overall: allHealthy ? 'ok' : 'error',
      });
    }

    return {
      status: allHealthy ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        database: dbCheck,
        redis: redisCheck,
      },
    };
  }

  private async checkDatabase(): Promise<{
    status: 'up' | 'down';
    responseTime?: number;
  }> {
    try {
      logVerbose('[HealthCheck] Checking database connection...');
      const startTime = Date.now();

      // Add timeout to prevent hanging
      const queryPromise = this.dataSource.query('SELECT 1');
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Database query timeout')), 3000),
      );

      await Promise.race([queryPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      logVerbose(`[HealthCheck] ✅ Database check passed (${responseTime}ms)`);
      return {
        status: 'up',
        responseTime,
      };
    } catch (error) {
      console.error('[HealthCheck] ❌ Database health check failed:', error.message);
      return {
        status: 'down',
      };
    }
  }

  private async checkRedis(): Promise<{
    status: 'up' | 'down';
    responseTime?: number;
  }> {
    try {
      logVerbose('[HealthCheck] Checking Redis connection...');
      const startTime = Date.now();

      // Add timeout to prevent hanging
      const pingPromise = this.redis.ping();
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Redis ping timeout')), 3000),
      );

      await Promise.race([pingPromise, timeoutPromise]);
      const responseTime = Date.now() - startTime;

      logVerbose(`[HealthCheck] ✅ Redis check passed (${responseTime}ms)`);
      return {
        status: 'up',
        responseTime,
      };
    } catch (error) {
      console.error('[HealthCheck] ❌ Redis health check failed:', error.message);
      return {
        status: 'down',
      };
    }
  }
}
