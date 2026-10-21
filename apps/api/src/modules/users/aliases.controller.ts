import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { OnboardingPatchSchema, UpdateProfileSchema } from '../../common/validation/api-schemas';

/**
 * PRD-path aliases for the authenticated account. These share the exact
 * implementation (and therefore the same ownership and server-controlled
 * fields) as `/users/me` and `/users/onboarding`; they are additive, so both
 * path families stay supported.
 */
@ApiTags('Users')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller()
export class AccountAliasesController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the current user profile', description: 'Alias of `GET /users/me`. The account is derived from the access token; no user identifier is accepted from the client.' })
  @ApiResponse({ status: 200, description: 'Account and profile summary.' })
  @ApiResponse({ status: 401, description: 'Missing, expired, or invalid access token.' })
  async getMe(@Req() req: any) {
    return this.usersService.getProfile(req.user.sub);
  }

  @Patch('me')
  @ApiOperation({ summary: 'Update the current user profile', description: 'Alias of `PATCH /users/me`. Partial update: include only fields to change. Dates use YYYY-MM-DD; unknown fields are rejected.' })
  @ApiResponse({ status: 200, description: 'Profile updated.' })
  async patchMe(@Req() req: any, @Body(new ZodValidationPipe(UpdateProfileSchema)) body) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Get('onboarding')
  @ApiOperation({ summary: 'Get the current user’s onboarding draft', description: 'Alias of `GET /users/onboarding`. Resumable, owner-scoped onboarding state.' })
  @ApiResponse({ status: 200, description: 'Onboarding draft or an empty first-step draft.' })
  async getOnboarding(@Req() req: any) {
    return this.usersService.getOnboarding(req.user.sub);
  }

  @Patch('onboarding')
  @ApiOperation({ summary: 'Save onboarding progress', description: 'Alias of `PATCH /users/onboarding`. Canonical steps are numbered 1 through 8; the draft can be resumed or rewound.' })
  @ApiResponse({ status: 200, description: 'Onboarding draft saved.' })
  async patchOnboarding(@Req() req: any, @Body(new ZodValidationPipe(OnboardingPatchSchema)) body) {
    return this.usersService.updateOnboarding(req.user.sub, body);
  }

  @Post('onboarding/complete')
  @ApiOperation({ summary: 'Complete onboarding', description: 'Alias of `POST /users/onboarding/complete`. Completes onboarding only after all eight steps and the required objective are saved. The server sets onboardingStatus; it is not client-editable.' })
  @ApiResponse({ status: 201, description: 'Onboarding completed and profile preferences committed.' })
  @ApiResponse({ status: 422, description: 'Onboarding draft is incomplete or already in an invalid state.' })
  async completeOnboarding(@Req() req: any) {
    return this.usersService.completeOnboarding(req.user.sub);
  }
}
