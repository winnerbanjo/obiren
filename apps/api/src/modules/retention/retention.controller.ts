import { Controller, Get, Headers, Post, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RetentionService } from './retention.service';
import { assertCronSecret } from '../../common/auth/cron-secret';

/**
 * Retention housekeeping.
 *
 * `GET` exists because schedulers (Vercel Cron among them) only issue GET; it
 * authenticates with the same secret transports as `POST`. Both variants accept
 * `?dryRun=false`; deletion additionally requires RETENTION_EXECUTION_ENABLED.
 */
@ApiTags('Notifications and webhooks')
@Controller('internal/cron')
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Get('run-retention')
  @ApiOperation({
    summary: 'Run retention housekeeping (internal, scheduler)',
    description:
      'Scheduler-facing variant of `POST /internal/cron/run-retention`, for hosts whose cron only issues GET. Previews by default; send `?dryRun=false` (and set RETENTION_EXECUTION_ENABLED=true) to delete expired operational records. Account health records are never purged.',
  })
  @ApiHeader({ name: 'X-Cron-Secret', required: false, description: 'Value configured by the operator as CRON_SECRET. `Authorization: Bearer <CRON_SECRET>` is also accepted.' })
  @ApiQuery({ name: 'dryRun', required: false, enum: ['true', 'false'], description: 'Preview unless explicitly false.' })
  @ApiResponse({ status: 200, description: 'Per-collection counts plus the explicit dry-run/executed state.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid cron credential.' })
  async runScheduled(
    @Headers('x-cron-secret') secret?: string,
    @Headers('authorization') authorization?: string,
    @Query('cronSecret') querySecret?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    assertCronSecret({ headerSecret: secret, authorization, querySecret });
    return this.retentionService.run(dryRun !== 'false');
  }

  @Post('run-retention')
  @ApiOperation({
    summary: 'Run retention housekeeping (internal, operator)',
    description:
      'Previews by default; send `?dryRun=false` with `RETENTION_EXECUTION_ENABLED=true` to delete expired operational records (sessions, expired invitations, location sessions, expired shares/briefs, idempotency rows, old webhook audit rows). Account health records are never purged here. Not a mobile-client operation.',
  })
  @ApiHeader({ name: 'X-Cron-Secret', required: false, description: 'Value configured by the operator as CRON_SECRET. `Authorization: Bearer <CRON_SECRET>` is also accepted.' })
  @ApiQuery({ name: 'dryRun', required: false, enum: ['true', 'false'], description: 'Preview unless explicitly false.' })
  @ApiResponse({ status: 201, description: 'Per-collection counts plus the explicit dry-run/executed state.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid cron credential.' })
  async run(
    @Headers('x-cron-secret') secret?: string,
    @Headers('authorization') authorization?: string,
    @Query('cronSecret') querySecret?: string,
    @Query('dryRun') dryRun?: string,
  ) {
    assertCronSecret({ headerSecret: secret, authorization, querySecret });
    return this.retentionService.run(dryRun !== 'false');
  }
}
