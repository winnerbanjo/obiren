import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OnboardingPatchSchema, UpdateProfileSchema } from '../../common/validation/api-schemas';

@ApiTags('Users')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile (deprecated)', description: 'Deprecated: use `GET /me`, the PRD path. Both paths call the same service. Returns the authenticated account and profile summary; no user ID is accepted from the client.', deprecated: true })
  @ApiResponse({ status: 200, description: 'Profile returned.' })
  @ApiResponse({ status: 401, description: 'Missing, expired, or invalid access token.' })
  async getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.sub);
  }

  @Get('onboarding')
  @ApiOperation({ summary: 'Get the onboarding draft (deprecated)', description: 'Deprecated: use `GET /onboarding`, the PRD path. Both paths call the same service. Returns the authenticated user’s resumable onboarding state.', deprecated: true })
  @ApiResponse({ status: 200, description: 'Onboarding draft or an empty first-step draft.' })
  async getOnboarding(@Req() req: any) {
    return this.usersService.getOnboarding(req.user.sub);
  }

  @Patch('onboarding')
  @ApiOperation({ summary: 'Save onboarding progress (deprecated)', description: 'Deprecated: use `PATCH /onboarding`, the PRD path. Both paths call the same service. Canonical steps are numbered 1 through 8; the draft can be resumed or rewound.', deprecated: true })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { step: { type: 'integer', minimum: 1, maximum: 8 }, objective: { type: 'string', enum: ['CYCLE_TRACKING', 'PREGNANCY', 'FERTILITY', 'GENERAL_WELLNESS'] }, lastMenstrualPeriod: { type: 'string', format: 'date' }, cycleLengthDays: { type: 'integer', minimum: 20, maximum: 45 }, bleedingDays: { type: 'integer', minimum: 1, maximum: 15 }, conditions: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 80 } }, concerns: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 120 } }, notificationsEnabled: { type: 'boolean' } } } })
  @ApiResponse({ status: 200, description: 'Onboarding draft saved.' })
  async updateOnboarding(@Req() req: any, @Body(new ZodValidationPipe(OnboardingPatchSchema)) body) {
    return this.usersService.updateOnboarding(req.user.sub, body);
  }

  @Post('onboarding/complete')
  @ApiOperation({ summary: 'Complete onboarding (deprecated)', description: 'Deprecated: use `POST /onboarding/complete`, the PRD path. Both paths call the same service. Completes onboarding after all eight steps and the required objective are saved; the server sets onboardingStatus.', deprecated: true })
  @ApiResponse({ status: 201, description: 'Onboarding completed and profile preferences committed.' })
  @ApiResponse({ status: 422, description: 'Onboarding draft is incomplete or already in an invalid state.' })
  async completeOnboarding(@Req() req: any) {
    return this.usersService.completeOnboarding(req.user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile (deprecated)', description: 'Deprecated: use `PATCH /me`, the PRD path. Both paths call the same service. Partial update: include only fields to change. Unknown fields are rejected.', deprecated: true })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { firstName: { type: 'string', maxLength: 80 }, lastName: { type: 'string', maxLength: 80 }, displayName: { type: 'string', maxLength: 120 }, dateOfBirth: { type: 'string', format: 'date' }, phoneNumber: { type: 'string', maxLength: 32 }, countryCode: { type: 'string', enum: ['NG', 'GH', 'GB', 'US'] }, timeZone: { type: 'string', maxLength: 64, example: 'Africa/Lagos' }, trackingGoal: { type: 'string', enum: ['CYCLE_TRACKING', 'PREGNANCY', 'FERTILITY', 'GENERAL_WELLNESS'] }, preferredLanguage: { type: 'string', minLength: 2, maxLength: 8 } } } })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  @ApiResponse({ status: 401, description: 'Missing, expired, or invalid access token.' })
  async updateProfile(@Req() req: any, @Body(new ZodValidationPipe(UpdateProfileSchema)) body) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Get('me/privacy-jobs')
  @ApiOperation({ summary: 'List personal-data export and deletion requests', description: 'Lists only privacy jobs belonging to the authenticated account. Deletion job execution is operator-managed and is not proof of completed erasure.' })
  @ApiResponse({ status: 200, description: 'Owner-scoped privacy job records.' })
  async getPrivacyJobs(@Req() req: any) { return this.usersService.getPrivacyJobs(req.user.sub); }

  @Get('me/export')
  @ApiOperation({ summary: 'Export the current user’s personal data', description: 'Returns the authenticated user’s available account and profile data in a portable JSON representation.' })
  @ApiResponse({ status: 200, description: 'Personal data export.' })
  async exportData(@Req() req: any) {
    return this.usersService.exportUserData(req.user.sub);
  }

  @Post('me/request-deletion')
  @ApiOperation({ summary: 'Request account deletion', description: 'Schedules account deletion after a 30-day grace period. This is a consequential account action; the user can cancel it during the grace period.' })
  @ApiResponse({ status: 201, description: 'Deletion request accepted with the scheduled deletion date.' })
  async requestDeletion(@Req() req: any) {
    return this.usersService.requestAccountDeletion(req.user.sub);
  }

  @Post('me/cancel-deletion')
  @ApiOperation({ summary: 'Cancel a pending account deletion', description: 'Restores the current account to active status and clears its pending deletion request.' })
  @ApiResponse({ status: 201, description: 'Pending deletion cancelled.' })
  async cancelDeletion(@Req() req: any) {
    return this.usersService.cancelAccountDeletion(req.user.sub);
  }
}
