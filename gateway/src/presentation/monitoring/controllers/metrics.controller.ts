import { Controller, Get, Header } from '@nestjs/common';
import { QueueFacade } from '@queue/application/services/queue.facade';
import { GLOBAL_QUEUE_EVENT_ID } from '@queue/application/services/queue-ticket.service';

@Controller()
export class MetricsController {
  constructor(private readonly queueFacade: QueueFacade) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getMetrics(): Promise<string> {
    const lengths = await this.queueFacade.getQueueLengths();
    const timestampSeconds = Math.floor(Date.now() / 1000);

    const lines: string[] = [
      '# HELP flash_queue_length Current queue length per event',
      '# TYPE flash_queue_length gauge',
      ...lengths.map(({ eventId, queueLength }) => {
        const safeEventId =
          eventId === GLOBAL_QUEUE_EVENT_ID ? 'global' : eventId;
        return `flash_queue_length{event="${safeEventId}"} ${queueLength}`;
      }),
      '# HELP flash_queue_events Number of queue events tracked',
      '# TYPE flash_queue_events gauge',
      `flash_queue_events ${lengths.length}`,
      '# HELP flash_queue_metrics_collected_at Metrics collection timestamp (seconds)',
      '# TYPE flash_queue_metrics_collected_at gauge',
      `flash_queue_metrics_collected_at ${timestampSeconds}`,
    ];

    return `${lines.join('\n')}\n`;
  }
}
