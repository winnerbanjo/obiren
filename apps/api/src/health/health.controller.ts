import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { env } from '../config/env.validation';
import { configurationSummary } from '../common/config/configuration-report';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @Get()
  @ApiOperation({
    summary: 'Check API liveness and configuration state',
    description:
      'Lightweight liveness probe. A successful response confirms the HTTP service is running; it does not guarantee downstream dependencies are healthy. The `configuration` block lists every missing environment variable and what it disables, so a deployment started with `ALLOW_DEGRADED_STARTUP=true` reports `status: "degraded"` instead of failing silently. Variable names only — never values.',
  })
  @ApiResponse({
    status: 200,
    description: 'Service liveness, configuration state and server timestamp.',
    content: {
      'application/json': {
        example: {
          success: true,
          data: {
            status: 'degraded',
            service: 'obiren-api',
            version: '1.0.0',
            environment: 'production',
            timestamp: '2026-10-23T12:00:00.000Z',
            configuration: {
              degraded: true,
              environment: 'production',
              requiredMissing: 1,
              missing: [
                {
                  variable: 'HEALTH_DATA_ENCRYPTION_KEY',
                  feature: 'Private health notes',
                  impact:
                    'Daily-log notes, pregnancy notes and consultation messages return 503 instead of being stored in plaintext.',
                  required: true,
                },
              ],
              docs: 'docs/DEPLOYMENT_ENV_STAGING.md',
              note: 'This API is running in degraded staging mode. Missing required settings are listed above; gated features fail closed with 503 instead of pretending to work.',
            },
          },
        },
      },
    },
  })
  health() {
    const config = env();
    return {
      success: true,
      data: {
        status: config.degraded ? 'degraded' : 'ok',
        service: 'obiren-api',
        version: '1.0.0',
        environment: config.nodeEnv,
        timestamp: new Date().toISOString(),
        configuration: configurationSummary(config),
      },
    };
  }
}
