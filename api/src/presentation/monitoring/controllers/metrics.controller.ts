import { Controller, Get } from '@nestjs/common';
import { MetricsService } from '../../../application/monitoring/metrics.service';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getMetrics(): Promise<string> {
    const metrics = await this.metricsService.collectMetrics();
    return this.metricsService.formatPrometheus(metrics);
  }
}
