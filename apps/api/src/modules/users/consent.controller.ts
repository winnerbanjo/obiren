import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { RecordConsentSchema } from '../../common/validation/api-schemas';
import { ConsentService } from './consent.service';

@ApiTags('Consents')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('consents')
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Get()
  @ApiOperation({
    summary: 'Get consent status and immutable history',
    description: 'Returns the latest recorded choice per purpose plus the append-only grant/revocation event history for the authenticated user.',
  })
  @ApiResponse({ status: 200, description: 'Consent history; no records means no consent has been recorded.' })
  async getConsents(@Req() req: any) {
    return this.consentService.getHistory(req.user.sub);
  }

  @Post()
  @ApiOperation({
    summary: 'Record a purpose-specific consent decision',
    description: 'Appends a grant or revocation event. Previous consent evidence is never overwritten. A recorded grant is not legal advice or proof that a purpose is lawful.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      required: ['purpose', 'policyVersion', 'granted', 'source'],
      properties: {
        purpose: {
          type: 'string',
          enum: ['terms_of_service_acknowledgement', 'privacy_notice_acknowledgement', 'health_data_processing', 'care_communications', 'health_sharing', 'location_sharing', 'marketing'],
        },
        policyVersion: { type: 'string', minLength: 1, maxLength: 40 },
        granted: { type: 'boolean' },
        source: { type: 'string', enum: ['onboarding', 'settings', 'feature_action'] },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Consent event appended.' })
  @ApiResponse({ status: 400, description: 'Invalid consent purpose, source, policy version, or decision.' })
  async recordConsent(@Req() req: any, @Body(new ZodValidationPipe(RecordConsentSchema)) body) {
    return this.consentService.record(req.user.sub, body);
  }
}
