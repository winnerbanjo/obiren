import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { env } from '../../config/env.validation';
import { User, UserDocument, UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { Session, SessionDocument } from '../../database/schemas/session.schema';
import { MailService } from '../mail/mail.service';
import { shouldExposeDevTokens } from '../../common/auth/token-exposure';
import { MfaCredential, MfaCredentialDocument } from '../../database/schemas/mfa.schema';
import { decryptHealthNote, encryptHealthNote } from '../../common/crypto/health-data-crypto';
import { buildOtpauthUrl, generateRecoveryCodes, generateTotpSecret, hashRecoveryCode, verifyTotp } from '../../common/auth/totp';
import { GoogleTokenVerifier } from './google-token-verifier';

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
    @InjectModel(MfaCredential.name) private mfaModel: Model<MfaCredentialDocument>,
    private jwtService: JwtService,
    private readonly mail: MailService,
    private readonly googleVerifier: GoogleTokenVerifier,
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
    await this.mail.trySend('verification', () => this.mail.sendVerificationEmail(user.email, verificationToken));

    return {
      success: true,
      data: {
        userId: (user._id as Types.ObjectId).toString(),
        email: user.email,
        status: user.status,
        // Production delivers the token only by email. Non-production echoes it
        // for local development and automated tests.
        ...(shouldExposeDevTokens(env().nodeEnv) ? { verificationToken } : {}),
        message: 'Account created. Check your email to verify your address.',
      },
      meta: this.meta(),
    };
  }

  async login(dto: { email: string; password: string; platform: string }) {
    const user = await this.userModel.findOne({ emailNormalized: dto.email });

    // Google-only accounts have no password hash. Treat them as a failed
    // password sign-in instead of asking Argon2 to verify against nothing.
    if (!user || !user.passwordHash || !(await argon2.verify(user.passwordHash, dto.password))) {
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

    // Opt-in staff MFA: passwords are verified first, then a short-lived
    // challenge token is returned instead of session tokens.
    const credential = await this.mfaModel.findOne({ userId: user._id, status: 'enabled' }).lean().exec();
    if (credential) {
      return {
        success: true,
        data: {
          mfaRequired: true,
          mfaToken: this.signMfaToken((user._id as Types.ObjectId).toString()),
          methods: ['totp'],
          message: 'Enter the 6-digit authenticator code, or a recovery code, to finish signing in.',
        },
        meta: this.meta(),
      };
    }

    return this.issueSession(user, dto.platform);
  }

  /**
   * Sign in with Google.
   *
   * The ID token is verified server-side before anything is read or written:
   * signature, issuer, expiry and audience. Consequences are deliberate and
   * recorded in docs/DECISIONS.md:
   *   - a first-time verified Google email creates an active account (Google
   *     has already proven control of the address);
   *   - a matching locally registered account is linked only when that account
   *     already has a verified email, which blocks pre-registration hijacking;
   *   - an account with MFA enabled still needs its second factor, so Google
   *     sign-in cannot bypass it.
   */
  async googleLogin(dto: { idToken: string; platform: string }) {
    const identity = await this.googleVerifier.verify(dto.idToken);

    if (!identity.emailVerified) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'AUTH_GOOGLE_EMAIL_UNVERIFIED',
          message: 'Google has not verified this email address, so it cannot be used to sign in.',
        },
      });
    }

    let user = await this.userModel.findOne({ googleSub: identity.subject });

    if (!user) {
      const existing = await this.userModel.findOne({ emailNormalized: identity.email });

      if (existing) {
        if (existing.googleSub && existing.googleSub !== identity.subject) {
          throw new ConflictException({
            success: false,
            error: {
              code: 'AUTH_GOOGLE_ACCOUNT_CONFLICT',
              message: 'This email is already linked to a different Google account.',
            },
          });
        }

        if (!existing.emailVerifiedAt) {
          // Linking here would hand an account that someone else registered
          // (but never proved ownership of) to the Google account holder.
          throw new ForbiddenException({
            success: false,
            error: {
              code: 'AUTH_GOOGLE_ACCOUNT_UNVERIFIED',
              message:
                'An unverified account already uses this email. Claim it with “forgot password”, then link Google from settings.',
            },
          });
        }

        existing.googleSub = identity.subject;
        existing.authProviders = Array.from(new Set([...(existing.authProviders ?? ['password']), 'google']));
        await existing.save();
        user = existing;
      } else {
        user = await this.userModel.create({
          email: identity.email,
          emailNormalized: identity.email,
          googleSub: identity.subject,
          authProviders: ['google'],
          // Google proved control of the address, so no verification email is
          // required and the account can be used immediately.
          status: 'active',
          emailVerifiedAt: new Date(),
          roles: ['user'],
        });

        await this.userProfileModel.create({
          userId: user._id,
          firstName: identity.firstName ?? '',
          lastName: identity.lastName ?? '',
          displayName:
            [identity.firstName, identity.lastName].filter(Boolean).join(' ') || identity.email.split('@')[0],
        });
      }
    }

    if (['suspended', 'restricted', 'deleted'].includes(user.status)) {
      throw new ForbiddenException({
        success: false,
        error: { code: 'AUTH_ACCOUNT_DISABLED', message: 'This account is not permitted to sign in.' },
      });
    }

    // Signing in with Google must never skip a second factor that the account
    // owner enabled for password sign-in.
    const credential = await this.mfaModel.findOne({ userId: user._id, status: 'enabled' }).lean().exec();
    if (credential) {
      return {
        success: true,
        data: {
          mfaRequired: true,
          mfaToken: this.signMfaToken((user._id as Types.ObjectId).toString()),
          methods: ['totp'],
          message: 'Enter the 6-digit authenticator code, or a recovery code, to finish signing in.',
        },
        meta: this.meta(),
      };
    }

    return this.issueSession(user, dto.platform);
  }

  /** Access/refresh pair; shared by password login and the MFA challenge. */
  async issueSession(user: UserDocument, platform: string) {
    const accessToken = this.signAccessToken(user);

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    await this.sessionModel.create({
      userId: user._id,
      refreshTokenHash: this.hashToken(rawRefreshToken),
      platform,
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

  // ---------------- multi-factor authentication ----------------

  private signMfaToken(userId: string): string {
    return this.jwtService.sign(
      { sub: userId, purpose: 'mfa' },
      { secret: env().jwtAccessSecret, expiresIn: '5m' },
    );
  }

  private encryptSecret(secret: string) {
    try {
      return encryptHealthNote(secret);
    } catch {
      throw new ServiceUnavailableException(
        'Multi-factor enrolment requires the configured encryption key. Nothing was changed.',
      );
    }
  }

  private decryptSecret(credential: MfaCredentialDocument): string {
    try {
      return decryptHealthNote({
        ciphertext: credential.secretCiphertext,
        iv: credential.secretIv,
        authTag: credential.secretAuthTag,
        keyId: credential.keyId,
      });
    } catch {
      throw new ServiceUnavailableException('The stored MFA secret could not be decrypted. Contact an administrator.');
    }
  }

  async mfaStatus(userId: string) {
    const credential = await this.mfaModel.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    return {
      success: true,
      data: {
        enabled: credential?.status === 'enabled',
        pendingEnrolment: credential?.status === 'pending',
        enabledAt: credential?.enabledAt ?? null,
        lastUsedAt: credential?.lastUsedAt ?? null,
        recoveryCodesRemaining: credential?.recoveryCodeHashes?.length ?? 0,
      },
      meta: this.meta(),
    };
  }

  /**
   * Starts enrolment. The secret is shown exactly once so it can be typed into
   * an authenticator app; only its ciphertext is stored.
   */
  async mfaEnroll(userId: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    const existing = await this.mfaModel.findOne({ userId: user._id });
    if (existing?.status === 'enabled') {
      throw new ConflictException('Multi-factor authentication is already enabled for this account');
    }

    const secret = generateTotpSecret();
    const encrypted = this.encryptSecret(secret);
    const { codes, hashes } = generateRecoveryCodes();

    await this.mfaModel.findOneAndUpdate(
      { userId: user._id },
      {
        $set: {
          secretCiphertext: encrypted.ciphertext,
          secretIv: encrypted.iv,
          secretAuthTag: encrypted.authTag,
          keyId: encrypted.keyId,
          status: 'pending',
          recoveryCodeHashes: hashes,
        },
        $unset: { enabledAt: 1, lastUsedAt: 1 },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    return {
      success: true,
      data: {
        status: 'pending',
        secret,
        otpauthUrl: buildOtpauthUrl(secret, user.email),
        recoveryCodes: codes,
        message: 'Add the secret to an authenticator app, then confirm with a 6-digit code. Recovery codes are shown only once.',
      },
      meta: this.meta(),
    };
  }

  async mfaVerifyEnrollment(userId: string, code: string) {
    const credential = await this.mfaModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!credential) throw new BadRequestException('Start multi-factor enrolment before confirming a code');
    if (credential.status === 'enabled') throw new ConflictException('Multi-factor authentication is already enabled');
    if (!verifyTotp(this.decryptSecret(credential), code)) {
      throw new UnauthorizedException('Invalid authentication code');
    }
    credential.status = 'enabled';
    credential.enabledAt = new Date();
    credential.lastUsedAt = new Date();
    await credential.save();
    return {
      success: true,
      data: {
        enabled: true,
        enabledAt: credential.enabledAt,
        recoveryCodesRemaining: credential.recoveryCodeHashes.length,
      },
      meta: this.meta(),
    };
  }

  async mfaDisable(userId: string, code: string) {
    const credential = await this.mfaModel.findOne({ userId: new Types.ObjectId(userId) });
    if (!credential || credential.status !== 'enabled') {
      throw new BadRequestException('Multi-factor authentication is not enabled for this account');
    }
    const secret = this.decryptSecret(credential);
    const recoveryIndex = credential.recoveryCodeHashes.indexOf(hashRecoveryCode(code));
    const accepted = verifyTotp(secret, code) || recoveryIndex >= 0;
    if (!accepted) throw new UnauthorizedException('Invalid authentication code');
    await this.mfaModel.deleteOne({ _id: credential._id });
    return {
      success: true,
      data: { enabled: false, message: 'Multi-factor authentication disabled. Sign-in now uses the password only.' },
      meta: this.meta(),
    };
  }

  /** Completes a login started while MFA was enabled. */
  async mfaChallenge(input: { mfaToken: string; code: string; platform: string }) {
    let payload: { sub?: string; purpose?: string } = {};
    try {
      payload = await this.jwtService.verifyAsync(input.mfaToken, { secret: env().jwtAccessSecret });
    } catch {
      throw new UnauthorizedException('The multi-factor challenge expired. Sign in again.');
    }
    if (payload.purpose !== 'mfa' || !payload.sub) {
      throw new UnauthorizedException('Invalid multi-factor challenge');
    }

    const user = await this.userModel.findById(payload.sub);
    if (!user || ['suspended', 'restricted', 'deleted'].includes(user.status)) {
      throw new ForbiddenException('This account is not permitted to sign in.');
    }

    const credential = await this.mfaModel.findOne({ userId: user._id, status: 'enabled' });
    if (!credential) throw new BadRequestException('Multi-factor authentication is not enabled for this account');

    const secret = this.decryptSecret(credential);
    let accepted = verifyTotp(secret, input.code);
    if (!accepted) {
      const recoveryIndex = credential.recoveryCodeHashes.indexOf(hashRecoveryCode(input.code));
      if (recoveryIndex >= 0) {
        // A recovery code is single-use.
        credential.recoveryCodeHashes.splice(recoveryIndex, 1);
        accepted = true;
      }
    }
    if (!accepted) throw new UnauthorizedException('Invalid authentication code');

    credential.lastUsedAt = new Date();
    await credential.save();
    return this.issueSession(user, input.platform);
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
      const token = await this.issueEmailVerificationToken(user);
      await this.mail.trySend('verification', () => this.mail.sendVerificationEmail(user.email, token));
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
      await this.mail.trySend('password-reset', () => this.mail.sendPasswordResetEmail(user.email, raw));
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
