import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({ summary: 'Check API liveness', description: 'Lightweight liveness probe. A successful response confirms the HTTP service is running; it does not guarantee downstream dependencies are healthy.' })
  @ApiResponse({ status: 200, description: 'Service liveness and server timestamp.', content: { 'application/json': { example: { success: true, data: { status: 'ok', service: 'obiren-api', version: '1.0.0', timestamp: '2026-10-19T12:00:00.000Z' } } } } })
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
