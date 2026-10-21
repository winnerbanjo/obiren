import { Controller, Headers, Post, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RetentionService } from './retention.service';

@ApiTags('Notifications and webhooks')
@Controller('internal/cron')
export class RetentionController {
  constructor(private readonly retentionService: RetentionService) {}

  @Post('run-retention')
  @ApiOperation({
    summary: 'Run retention housekeeping (internal)',
    description: 'Internal scheduler operation that previews, or deletes, expired operational records (sessions, expired invitations, location sessions, expired shares/briefs, idempotency rows, old webhook audit rows). Deletion requires `dryRun=false` and `RETENTION_EXECUTION_ENABLED=true`; account health records are never purged here. Not a mobile-client operation.',
  })
  @ApiHeader({ name: 'X-Cron-Secret', required: true, description: 'Value configured by the operator as CRON_SECRET.' })
  @ApiResponse({ status: 201, description: 'Per-collection counts plus the explicit dry-run/executed state.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid cron credential.' })
  async run(@Headers('x-cron-secret') secret?: string) {
    const expected = process.env.CRON_SECRET;
    if (!expected || !secret || secret !== expected) {
      throw new UnauthorizedException('Invalid or missing cron credential');
    }
    return this.retentionService.run(false);
  }
}
