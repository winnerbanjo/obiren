import { BadRequestException, ForbiddenException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { env } from '../../config/env.validation';
import { User, UserDocument, UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { Session, SessionDocument } from '../../database/schemas/session.schema';

const ACCESS_TTL_SECONDS = 15 * 60;
const REFRESH_TTL_DAYS = 30;
const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private jwtService: JwtService,
  ) {}

  // ---------------- helpers ----------------

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private signAccessToken(user: UserDocument): string {
    return this.jwtService.sign(
      { sub: (user._id as Types.ObjectId).toString(), email: user.email, roles: user.roles },
      { secret: env().jwtAccessSecret, expiresIn: '15m' },
    );
  }

  private createRefreshExpiry(): Date {
    return new Date(Date.now() + REFRESH_TTL_DAYS * 24 * 60 * 60 * 1000);
  }

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  // ---------------- registration & login ----------------

  async register(dto: { email: string; password: string; firstName: string; lastName: string; countryCode: string; preferredLanguage: string }) {
    const existing = await this.userModel.findOne({ emailNormalized: dto.email });
    if (existing) {
      throw new BadRequestException({
        success: false,
        error: { code: 'AUTH_EMAIL_TAKEN', message: 'An account with this email already exists.' },
      });
    }

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.userModel.create({
      email: dto.email,
      emailNormalized: dto.email,
      passwordHash,
      status: 'pending_verification',
      roles: ['user'],
      countryCode: dto.countryCode,
      preferredLanguage: dto.preferredLanguage,
    });

    await this.userProfileModel.create({
      userId: user._id,
      firstName: dto.firstName,
      lastName: dto.lastName,
      displayName: `${dto.firstName} ${dto.lastName}`.trim(),
      countryCode: dto.countryCode,
      timeZone: dto.countryCode === 'GB' ? 'Europe/London' : dto.countryCode === 'US' ? 'America/New_York' : 'Africa/Lagos',
    });

    const verificationToken = await this.issueEmailVerificationToken(user);

    return {
      success: true,
      data: {
        userId: (user._id as Types.ObjectId).toString(),
        email: user.email,
        status: user.status,
        // In production the token is delivered by email. It is surfaced here so
        // the flow is testable until an email provider is wired (see README).
        ...(env().nodeEnv === 'production' ? {} : { verificationToken }),
        message: 'Account created. Check your email to verify your address.',
      },
      meta: this.meta(),
    };
  }

  async login(dto: { email: string; password: string; platform: string }) {
    const user = await this.userModel.findOne({ emailNormalized: dto.email });

    if (!user || !(await argon2.verify(user.passwordHash ?? '', dto.password))) {
      throw new UnauthorizedException({
        success: false,
        error: { code: 'AUTH_INVALID_CREDENTIALS', message: 'The email address or password is incorrect.' },
      });
    }

    if (user.status === 'suspended' || user.status === 'restricted' || user.status === 'deleted') {
      throw new ForbiddenException({
        success: false,
        error: { code: 'AUTH_ACCOUNT_DISABLED', message: 'This account is not permitted to sign in.' },
      });
    }

    const accessToken = this.signAccessToken(user);

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    await this.sessionModel.create({
      userId: user._id,
      refreshTokenHash: this.hashToken(rawRefreshToken),
      platform: dto.platform,
      expiresAt: this.createRefreshExpiry(),
    });

    user.lastLoginAt = new Date();
    await user.save();

    const emailVerified = Boolean(user.emailVerifiedAt);

    return {
      success: true,
      data: {
        user: {
          id: (user._id as Types.ObjectId).toString(),
          email: user.email,
          countryCode: user.countryCode,
          roles: user.roles,
          status: user.status,
          emailVerified,
        },
        tokens: {
          accessToken,
          accessTokenExpiresIn: '15m',
          refreshToken: rawRefreshToken,
          refreshTokenExpiresIn: '30d',
        },
      },
      meta: this.meta(),
    };
  }

  // ---------------- refresh / logout / sessions ----------------

  async refreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.sessionModel.findOne({ refreshTokenHash: tokenHash });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Replay detection: a revoked token being reused revokes the whole family.
    if (session.revokedAt) {
      await this.sessionModel.updateMany(
        { userId: session.userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), revokeReason: 'TOKEN_REUSE_REPLAY_ATTACK' } },
      );
      throw new UnauthorizedException('Security alert: Token reuse detected. All sessions revoked.');
    }

    if (new Date() > session.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.userModel.findById(session.userId);
    if (!user || ['suspended', 'restricted', 'deleted'].includes(user.status)) {
      await this.sessionModel.updateMany(
        { userId: session.userId, revokedAt: { $exists: false } },
        { $set: { revokedAt: new Date(), revokeReason: 'ACCOUNT_DISABLED' } },
      );
      throw new UnauthorizedException('Account is no longer active');
    }

    // Rotate: revoke the old session, create a new one.
    session.revokedAt = new Date();
    session.revokeReason = 'ROTATED';
    await session.save();

    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    await this.sessionModel.create({
      userId: user._id,
      refreshTokenHash: this.hashToken(newRawRefreshToken),
      platform: session.platform,
      expiresAt: this.createRefreshExpiry(),
    });

    return {
      success: true,
      data: {
        accessToken: this.signAccessToken(user),
        refreshToken: newRawRefreshToken,
      },
      meta: this.meta(),
    };
  }

  async logout(rawToken: string) {
    await this.sessionModel.updateOne(
      { refreshTokenHash: this.hashToken(rawToken) },
      { $set: { revokedAt: new Date(), revokeReason: 'USER_LOGOUT' } },
    );
    return { success: true, message: 'Session logged out successfully' };
  }

  async getSessions(userId: string) {
    const sessions = await this.sessionModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ createdAt: -1 })
      .exec();
    return { success: true, data: sessions, meta: this.meta() };
  }

  async me(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const profile = await this.userProfileModel.findOne({ userId: new Types.ObjectId(userId) });
    return {
      success: true,
      data: {
        id: (user._id as Types.ObjectId).toString(),
        email: user.email,
        roles: user.roles,
        status: user.status,
        countryCode: user.countryCode,
        emailVerified: Boolean(user.emailVerifiedAt),
        profile: profile
          ? {
              firstName: profile.firstName,
              lastName: profile.lastName,
              displayName: profile.displayName,
              trackingGoal: profile.trackingGoal,
              onboardingStatus: profile.onboardingStatus,
            }
          : null,
      },
      meta: this.meta(),
    };
  }

  // ---------------- email verification (Phase 4) ----------------

  private async issueEmailVerificationToken(user: UserDocument): Promise<string> {
    const raw = crypto.randomBytes(32).toString('hex');
    user.emailVerificationTokenHash = this.hashToken(raw);
    user.emailVerificationExpiresAt = new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS);
    await user.save();
    return raw;
  }

  async resendVerification(email: string) {
    const user = await this.userModel.findOne({ emailNormalized: email });
    // Generic response: never reveal whether the account exists.
    if (user && !user.emailVerifiedAt && user.status === 'pending_verification') {
      await this.issueEmailVerificationToken(user);
    }
    return {
      success: true,
      data: { message: 'If that email can be verified, a new verification link has been sent.' },
      meta: this.meta(),
    };
  }

  async verifyEmail(rawToken: string) {
    const user = await this.userModel.findOne({
      emailVerificationTokenHash: this.hashToken(rawToken),
      emailVerificationExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException({
        success: false,
        error: { code: 'AUTH_VERIFICATION_INVALID', message: 'This verification link is invalid or has expired.' },
      });
    }

    // Single use: consume the token.
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiresAt = undefined;
    user.emailVerifiedAt = new Date();
    if (user.status === 'pending_verification') user.status = 'active';
    await user.save();

    return {
      success: true,
      data: { email: user.email, status: user.status, emailVerified: true },
      meta: this.meta(),
    };
  }

  // ---------------- password reset (Phase 4) ----------------

  async requestPasswordReset(email: string) {
    const user = await this.userModel.findOne({ emailNormalized: email });
    if (user && user.status !== 'deleted') {
      const raw = crypto.randomBytes(32).toString('hex');
      user.passwordResetTokenHash = this.hashToken(raw);
      user.passwordResetExpiresAt = new Date(Date.now() + RESET_TOKEN_TTL_MS);
      await user.save();
      if (env().nodeEnv !== 'production') {
        this.logger.log(`[dev-only] password reset token for ${email}: ${raw}`);
      }
    }
    // Generic response: prevents email enumeration.
    return {
      success: true,
      data: { message: 'If an account exists for that email, password reset instructions have been sent.' },
      meta: this.meta(),
    };
  }

  async resetPassword(dto: { token: string; newPassword: string }) {
    const user = await this.userModel.findOne({
      passwordResetTokenHash: this.hashToken(dto.token),
      passwordResetExpiresAt: { $gt: new Date() },
    });

    if (!user) {
      throw new BadRequestException({
        success: false,
        error: { code: 'AUTH_RESET_INVALID', message: 'This reset link is invalid or has expired.' },
      });
    }

    user.passwordHash = await argon2.hash(dto.newPassword, { type: argon2.argon2id });
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;

    // Invalidate all existing sessions after a password reset.
    await this.sessionModel.updateMany(
      { userId: user._id, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokeReason: 'PASSWORD_RESET' } },
    );

    await user.save();

    return {
      success: true,
      data: { message: 'Password updated. Please sign in again.' },
      meta: this.meta(),
    };
  }
}
