import { Controller, Get } from '@nestjs/common';
import {
  HealthService,
  type HealthCheckResult,
} from 'src/application/monitoring/health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get()
  async checkHealth(): Promise<HealthCheckResult> {
    return this.healthService.check();
  }
}
