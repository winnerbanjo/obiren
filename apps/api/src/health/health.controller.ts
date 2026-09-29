import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  health() {
    return {
      success: true,
      data: {
        status: 'ok',
        service: 'obiren-api',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
