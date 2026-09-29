import { BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
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
} from '../../common/validation/api-schemas';

export const REFRESH_COOKIE = 'obiren_refresh';

const isProd = () => process.env.NODE_ENV === 'production';

const RequireEmailSchema = z.string().email('A valid email is required');

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async register(@Body(new ZodValidationPipe(RegisterSchema)) body) {
    return this.authService.register(body);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Res({ passthrough: true }) res: Response, @Body(new ZodValidationPipe(LoginSchema)) body) {
    const result = await this.authService.login(body);
    // Refresh token in an HTTP-only cookie (browser clients). The JSON body
    // also carries it for non-browser clients; browsers use the cookie.
    res.cookie(REFRESH_COOKIE, result.data.tokens.refreshToken, {
      httpOnly: true,
      secure: isProd(),
      sameSite: 'lax',
      path: '/api/v1/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    return result;
  }

  @Post('refresh')
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
  @HttpCode(HttpStatus.OK)
  async logout(@Res({ passthrough: true }) res: Response, @Req() req: Request, @Body(new ZodValidationPipe(LogoutSchema.optional())) body) {
    const token = (req as any)?.cookies?.[REFRESH_COOKIE] || body?.refreshToken;
    if (token) await this.authService.logout(token);
    res.clearCookie(REFRESH_COOKIE, { path: '/api/v1/auth' });
    return { success: true, message: 'Logged out.' };
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: any) {
    return this.authService.me(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@Req() req: any) {
    return this.authService.getSessions(req.user.sub);
  }

  // ---------------- email verification ----------------

  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  async verifyEmail(@Body(new ZodValidationPipe(VerifyEmailSchema)) body) {
    return this.authService.verifyEmail(body.token);
  }

  @Post('resend-verification')
  @HttpCode(HttpStatus.OK)
  async resendVerification(@Query('email', new ZodValidationPipe(RequireEmailSchema)) email: string) {
    return this.authService.resendVerification(email);
  }

  // ---------------- password reset ----------------

  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body(new ZodValidationPipe(ForgotPasswordSchema)) body) {
    return this.authService.requestPasswordReset(body.email);
  }

  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body(new ZodValidationPipe(ResetPasswordSchema)) body) {
    return this.authService.resetPassword(body);
  }
}
