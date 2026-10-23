import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { BriefsService } from './briefs.service';
import { AuthenticatedUser } from '../../common/auth/request-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/auth/roles';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { HealthBriefCreateSchema, MongoIdParam } from '../../common/validation/api-schemas';

@ApiTags('Health briefs')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('briefs')
export class BriefsController {
  constructor(private readonly briefsService: BriefsService) {}

  @Post('generate')
  @ApiOperation({
    summary: 'Generate a deterministic health brief for a clinician',
    description: 'Builds a traceable snapshot from the caller’s capped date range, requires current health-sharing consent and a verified, active clinician recipient, and returns a SHA-256 content hash with per-scope record counts. Free-text notes are never included and no inference is performed.',
  })
  @ApiBody({ schema: { type: 'object', required: ['recipientUserId', 'scopes', 'from', 'to', 'expiresAt'], additionalProperties: false, properties: { recipientUserId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }, scopes: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', enum: ['cycles', 'daily_logs', 'pregnancy'] } }, from: { type: 'string', format: 'date' }, to: { type: 'string', format: 'date' }, expiresAt: { type: 'string', format: 'date-time', description: 'Must be in the future and within 30 days.' } } } })
  @ApiResponse({ status: 201, description: 'Brief identifier, content hash and traceability counts.' })
  @ApiResponse({ status: 400, description: 'Invalid or inverted range, or self-recipient.' })
  @ApiResponse({ status: 404, description: 'Missing consent or no verified clinician recipient.' })
  async generate(@Req() req: { user: AuthenticatedUser }, @Body(new ZodValidationPipe(HealthBriefCreateSchema)) body) {
    return this.briefsService.generate(req.user.sub, body);
  }

  @Get(':id')
  @ApiParam({ name: 'id', description: '24-character brief identifier.' })
  @ApiOperation({ summary: 'Read a health brief', description: 'Available to the owner and the named recipient only. Expired or revoked briefs return 404.' })
  @ApiResponse({ status: 200, description: 'Brief snapshot, hash and viewer role.' })
  @ApiResponse({ status: 404, description: 'Brief not found, expired or revoked.' })
  async get(@Req() req: { user: AuthenticatedUser }, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.briefsService.get(req.user.sub, id);
  }

  @Delete(':id')
  @ApiParam({ name: 'id', description: '24-character brief identifier.' })
  @ApiOperation({ summary: 'Revoke a health brief', description: 'Owner-only revocation. The recipient immediately loses access.' })
  @ApiResponse({ status: 200, description: 'Brief revoked.' })
  @ApiResponse({ status: 404, description: 'Active brief not found for this account.' })
  async revoke(@Req() req: { user: AuthenticatedUser }, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.briefsService.revoke(req.user.sub, id);
  }
}

@ApiTags('Health briefs')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.CLINICIAN)
@Controller('specialists/me')
export class ClinicianSharedBriefsController {
  constructor(private readonly briefsService: BriefsService) {}

  @Get('shared-briefs')
  @ApiOperation({ summary: 'List briefs shared with the signed-in clinician', description: 'Active (unexpired, unrevoked) briefs whose recipient is this clinician account. Requires the clinician role.' })
  @ApiResponse({ status: 200, description: 'Shared briefs without snapshot bodies.' })
  async list(@Req() req: { user: AuthenticatedUser }) {
    return this.briefsService.listForRecipient(req.user.sub);
  }
}
