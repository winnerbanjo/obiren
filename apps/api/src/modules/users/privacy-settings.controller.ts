import { Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PrivacySettingsService } from './privacy-settings.service';
import { AuthenticatedUser } from '../../common/auth/request-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PrivacySettingsPatchSchema } from '../../common/validation/api-schemas';

@ApiTags('Users')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('privacy-settings')
export class PrivacySettingsController {
  constructor(private readonly privacySettingsService: PrivacySettingsService) {}

  @Get()
  @ApiOperation({
    summary: 'Read privacy settings and consent state',
    description: 'Returns the current decision for every consent purpose together with its policy version, plus non-legal preferences (analytics, crash reports, personalisation). An undecided purpose is reported as `granted: null`, never as a default yes.',
  })
  @ApiResponse({ status: 200, description: 'Consent purposes, preferences and data controls.' })
  async get(@Req() req: { user: AuthenticatedUser }) {
    return this.privacySettingsService.get(req.user.sub);
  }

  @Patch()
  @ApiOperation({
    summary: 'Update privacy settings',
    description: 'Purpose changes are appended to the consent history with the supplied policy version; preferences are updated separately. Nothing here changes account ownership or shared data retroactively.',
  })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { purposes: { type: 'array', maxItems: 7, items: { type: 'object', required: ['purpose', 'granted', 'policyVersion'], additionalProperties: false, properties: { purpose: { type: 'string', enum: ['terms_of_service_acknowledgement', 'privacy_notice_acknowledgement', 'health_data_processing', 'care_communications', 'health_sharing', 'location_sharing', 'marketing'] }, granted: { type: 'boolean' }, policyVersion: { type: 'string', maxLength: 40 } } } }, shareAnalytics: { type: 'boolean' }, shareCrashReports: { type: 'boolean' }, personalizedContent: { type: 'boolean' } } } })
  @ApiResponse({ status: 200, description: 'Updated privacy settings with the purposes that changed.' })
  @ApiResponse({ status: 400, description: 'Unknown purpose, missing policy version, or no field supplied.' })
  async update(@Req() req: { user: AuthenticatedUser }, @Body(new ZodValidationPipe(PrivacySettingsPatchSchema)) body) {
    return this.privacySettingsService.update(req.user.sub, body);
  }
}
