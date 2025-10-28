import { Controller, Get, HttpException, HttpStatus } from '@nestjs/common';
import {
  HealthService,
  type HealthCheckResult,
} from 'src/application/monitoring/health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async checkHealth(): Promise<HealthCheckResult> {
    const result = await this.healthService.check();

    // If health check fails, return HTTP 503 Service Unavailable
    if (result.status === 'error') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return result;
  }
}
