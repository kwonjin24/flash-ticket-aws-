import { Controller, Get, Header } from '@nestjs/common';

// Dummy data for pipeline testing
const PIPELINE_TEST_DATA = 'live-test-2025-10-29';

@Controller()
export class LiveController {
  @Get('live')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getLiveness(): string {
    return '# HELP service_live Service liveness signal\n# TYPE service_live gauge\nservice_live 1\n';
  }
}
