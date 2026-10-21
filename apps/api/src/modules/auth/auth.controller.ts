import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { z } from 'zod';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  RegisterSchema,
  LoginSchema,
  RefreshSchema,
  LogoutSchema,
  ForgotPasswordSchema,
  ResetPasswordSchema,
  VerifyEmailSchema,
  MfaVerifySchema,
  MfaDisableSchema,
  MfaLoginVerifySchema,
} from '../../common/validation/api-schemas';

export const REFRESH_COOKIE = 'obiren_refresh';

const isProd = () => process.env.NODE_ENV === 'production';

const RequireEmailSchema = z.string().email('A valid email is required');

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Create an account', description: 'Creates a pending account and sends an email-verification link. Email is normalized to lowercase. In development, the verification token is included in the response; production delivers it by email.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['email', 'password', 'firstName', 'lastName'], properties: { email: { type: 'string', format: 'email', maxLength: 320, example: 'maya@example.com' }, password: { type: 'string', format: 'password', minLength: 8, maxLength: 128, description: 'Must include at least one uppercase letter and one number.', example: 'SecurePass1' }, firstName: { type: 'string', maxLength: 80, example: 'Maya' }, lastName: { type: 'string', maxLength: 80, example: 'Okafor' }, countryCode: { type: 'string', enum: ['NG', 'GH', 'GB', 'US'], default: 'NG' }, preferredLanguage: { type: 'string', minLength: 2, maxLength: 8, default: 'en' } } } })
  @ApiResponse({ status: 201, description: 'Account created; email verification is pending.', content: { 'application/json': { example: { success: true, data: { userId: '66a0b6f3e5f21c8e7a112233', email: 'maya@example.com', status: 'pending_verification', message: 'Account created. Check your email to verify your address.' }, meta: { requestId: 'req_1729339200000' } } } } })
  @ApiResponse({ status: 400, description: 'Invalid request or email already registered.' })
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(new ZodValidationPipe(RegisterSchema)) body) {
    return this.authService.register(body);
  }

  @Post('login')
  @ApiOperation({ summary: 'Sign in', description: 'Returns a 15-minute bearer access token and a 30-day rotating refresh token. Native clients should set platform to ios or android and store refresh tokens in secure storage. Browser clients may use the HttpOnly obiren_refresh cookie.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['email', 'password'], properties: { email: { type: 'string', format: 'email', example: 'maya@example.com' }, password: { type: 'string', format: 'password', example: 'SecurePass1' }, platform: { type: 'string', enum: ['web', 'ios', 'android'], default: 'web', example: 'ios' } } } })
  @ApiResponse({ status: 200, description: 'Authenticated. Store accessToken and refreshToken from data.tokens.', content: { 'application/json': { example: { success: true, data: { user: { id: '66a0b6f3e5f21c8e7a112233', email: 'maya@example.com', countryCode: 'NG', roles: ['user'], status: 'active', emailVerified: true }, tokens: { accessToken: '<jwt-access-token>', accessTokenExpiresIn: '15m', refreshToken: '<opaque-refresh-token>', refreshTokenExpiresIn: '30d' } }, meta: { requestId: 'req_1729339200000' } } } } })
  @ApiResponse({ status: 401, description: 'Invalid email or password.', content: { 'application/json': { example: { success: false, error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'The email address or password is incorrect.' } } } } })
  @ApiResponse({ status: 403, description: 'Account is not permitted to sign in.' })
  @HttpCode(HttpStatus.OK)
  async login(@Res({ passthrough: true }) res: Response, @Body(new ZodValidationPipe(LoginSchema)) body) {
    const result = await this.authService.login(body);
    // MFA-enabled accounts receive only a short-lived challenge token here.
    if ('tokens' in result.data) {
      // Refresh token in an HTTP-only cookie (browser clients). The JSON body
      // also carries it for non-browser clients; browsers use the cookie.
      res.cookie(REFRESH_COOKIE, result.data.tokens.refreshToken, {
        httpOnly: true,
        secure: isProd(),
        sameSite: 'lax',
        path: '/api/v1/auth',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });
    }
    return result;
  }

  @Post('refresh')
  @ApiOperation({ summary: 'Rotate tokens', description: 'Exchanges a valid refresh token for a new access token and refresh token. The old refresh token is revoked immediately; replace it in secure storage. Native clients provide refreshToken in JSON. Browser clients may send the HttpOnly cookie.' })
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false, required: ['refreshToken'], properties: { refreshToken: { type: 'string', minLength: 20, maxLength: 256, description: 'Required for native clients; optional when the refresh cookie is present.' } } } })
  @ApiResponse({ status: 200, description: 'Tokens rotated successfully. Persist both returned tokens; the submitted refresh token can no longer be reused.', content: { 'application/json': { example: { success: true, data: { accessToken: '<new-jwt-access-token>', refreshToken: '<new-opaque-refresh-token>' }, meta: { requestId: 'req_1729339200000' } } } } })
  @ApiResponse({ status: 401, description: 'Refresh token is invalid, expired, revoked, or replayed.' })
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
    @Body(new ZodValidationPipe(RefreshSchema.optional())) body,
  ) {
    // Prefer the HTTP-only cookie; fall back to explicit body token (mobile/API clients).
    const token = (req as any)?.cookies?.[REFRESH_COOKIE] || body?.refreshToken;
    if (!token) {
      throw new BadRequestException('A refresh token is required.');
    }
    const result = await this.authService.refreshToken(token);
    res.cookie(REFRESH_COOKIE, result.data.refreshToken, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return result;
  }

  @Post('logout')
  @ApiOperation({ summary: 'Sign out and revoke a refresh session', description: 'Revokes the supplied refresh token and clears the browser refresh cookie. Native clients should pass their current refreshToken.' })
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false, properties: { refreshToken: { type: 'string', minLength: 20, maxLength: 256, description: 'Current refresh token for a native client.' } } } })
  @ApiResponse({ status: 200, description: 'Session revoked; safe to call again.' })
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response, @Req() req: Request, @Body(new ZodValidationPipe(LogoutSchema.optional())) body) {
    const token = (req as any)?.cookies?.[REFRESH_COOKIE] || body?.refreshToken;
    if (token) await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { success: true, message: 'Logged out.' };
  }

  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @Get('me')
  @ApiOperation({ summary: 'Get the authenticated account', description: 'Returns the account identity, roles, verification state, and a compact profile. Use this after sign-in or token refresh to hydrate the current-user state.' })
  @ApiResponse({ status: 200, description: 'Authenticated account.', content: { 'application/json': { example: { success: true, data: { id: '66a0b6f3e5f21c8e7a112233', email: 'maya@example.com', roles: ['user'], status: 'active', countryCode: 'NG', emailVerified: true, profile: { firstName: 'Maya', lastName: 'Okafor', displayName: 'Maya Okafor', trackingGoal: 'CYCLE_TRACKING', onboardingStatus: 'COMPLETED' } }, meta: { requestId: 'req_1729339200000' } } } } })
  @ApiResponse({ status: 401, description: 'Missing, expired, or invalid access token.' })
  async me(@Req() req: any) {
    return this.authService.me(req.user.sub);
  }

  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  @ApiOperation({ summary: 'List the authenticated account’s sessions', description: 'Returns the current user’s sessions newest first. Refresh-token values are never returned.' })
  @ApiResponse({ status: 200, description: 'Session metadata.' })
  async getSessions(@Req() req: any) {
    return this.authService.getSessions(req.user.sub);
  }

  // ---------------- multi-factor authentication ----------------

  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @Get('mfa/status')
  @ApiOperation({ summary: 'Get MFA status', description: 'Reports whether TOTP multi-factor authentication is enabled, pending enrolment, or unused for the authenticated account. Secrets and recovery codes are never returned.' })
  @ApiResponse({ status: 200, description: 'MFA state and remaining recovery codes.' })
  async mfaStatus(@Req() req: any) {
    return this.authService.mfaStatus(req.user.sub);
  }

  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @Post('mfa/enroll')
  @ApiOperation({ summary: 'Start TOTP enrolment', description: 'Generates a new authenticator secret and single-use recovery codes. The secret and codes are returned exactly once and only the encrypted secret is stored. Requires the configured encryption key; returns 503 otherwise.' })
  @ApiResponse({ status: 201, description: 'Pending enrolment with secret, otpauth URL and recovery codes.' })
  @ApiResponse({ status: 409, description: 'MFA is already enabled.' })
  @ApiResponse({ status: 503, description: 'Encryption key is not configured.' })
  async mfaEnroll(@Req() req: any) {
    return this.authService.mfaEnroll(req.user.sub);
  }

  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @Post('mfa/verify')
  @ApiOperation({ summary: 'Confirm enrolment', description: 'Confirms a pending enrolment with a 6-digit code. Only then does sign-in start requiring the second factor.' })
  @ApiBody({ schema: { type: 'object', required: ['code'], additionalProperties: false, properties: { code: { type: 'string', pattern: '^\\d{6}$' } } } })
  @ApiResponse({ status: 201, description: 'MFA enabled.' })
  @ApiResponse({ status: 400, description: 'No pending enrolment.' })
  @ApiResponse({ status: 401, description: 'Invalid code.' })
  async mfaVerify(@Req() req: any, @Body(new ZodValidationPipe(MfaVerifySchema)) body) {
    return this.authService.mfaVerifyEnrollment(req.user.sub, body.code);
  }

  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @Post('mfa/disable')
  @ApiOperation({ summary: 'Disable MFA', description: 'Requires a current 6-digit code or a recovery code. Disabling deletes the stored secret.' })
  @ApiBody({ schema: { type: 'object', required: ['code'], additionalProperties: false, properties: { code: { type: 'string', pattern: '^(\\d{6}|[A-Za-z2-7]{10})$' } } } })
  @ApiResponse({ status: 201, description: 'MFA disabled.' })
  @ApiResponse({ status: 400, description: 'MFA is not enabled.' })
  @ApiResponse({ status: 401, description: 'Invalid code.' })
  async mfaDisable(@Req() req: any, @Body(new ZodValidationPipe(MfaDisableSchema)) body) {
    return this.authService.mfaDisable(req.user.sub, body.code);
  }

  @Post('mfa/challenge')
  @ApiOperation({ summary: 'Complete sign-in with a second factor', description: 'Exchanges the short-lived MFA token returned by `/auth/login` plus a valid code for a normal access/refresh pair. Recovery codes are single-use.' })
  @ApiBody({ schema: { type: 'object', required: ['mfaToken', 'code'], additionalProperties: false, properties: { mfaToken: { type: 'string', minLength: 20, maxLength: 2048 }, code: { type: 'string', description: '6-digit authenticator code or 10-character recovery code.' }, platform: { type: 'string', enum: ['web', 'ios', 'android'], default: 'web' } } } })
  @ApiResponse({ status: 200, description: 'Authenticated with a fresh token pair.' })
  @ApiResponse({ status: 401, description: 'Expired challenge or invalid code.' })
  @HttpCode(HttpStatus.OK)
  async mfaChallenge(@Res({ passthrough: true }) res: Response, @Body(new ZodValidationPipe(MfaLoginVerifySchema)) body) {
    const result = await this.authService.mfaChallenge(body);
    res.cookie(REFRESH_COOKIE, result.data.tokens.refreshToken, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return result;
  }

  // ---------------- email verification ----------------

  @Post('verify-email')
  @ApiOperation({ summary: 'Verify an email address', description: 'Consumes the single-use, time-limited token delivered in the verification email.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['token'], properties: { token: { type: 'string', minLength: 20, maxLength: 256 } } } })
  @ApiResponse({ status: 200, description: 'Email verified.' })
  @ApiResponse({ status: 400, description: 'Verification token is invalid or expired.' })
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body(new ZodValidationPipe(VerifyEmailSchema)) body) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  @ApiQuery({ name: 'email', required: true, description: 'Email address to send a verification message to.', example: 'maya@example.com' })
  @ApiOperation({ summary: 'Resend email verification', description: 'Requests a new verification email. The generic response does not disclose whether the account exists.' })
  @ApiResponse({ status: 200, description: 'Generic confirmation returned to prevent account enumeration.' })
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Query('email', new ZodValidationPipe(RequireEmailSchema)) email: string) {
    return this.authService.resendVerification(email);
  }

  // ---------------- password reset ----------------

  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset', description: 'Sends password-reset instructions when an eligible account exists. The response is intentionally generic to prevent account enumeration.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['email'], properties: { email: { type: 'string', format: 'email', example: 'maya@example.com' } } } })
  @ApiResponse({ status: 200, description: 'Generic confirmation returned regardless of account existence.' })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) body) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  @ApiOperation({ summary: 'Set a new password', description: 'Consumes a valid password-reset token and revokes all existing sessions. Passwords require at least eight characters, one uppercase letter, and one number.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['token', 'newPassword'], properties: { token: { type: 'string', minLength: 20, maxLength: 256 }, newPassword: { type: 'string', format: 'password', minLength: 8, maxLength: 128, example: 'NewSecurePass1' } } } })
  @ApiResponse({ status: 200, description: 'Password updated; sign in again.' })
  @ApiResponse({ status: 400, description: 'Reset token is invalid or expired.' })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) body) {
    return this.authService.resetPassword(body);
  }
}
