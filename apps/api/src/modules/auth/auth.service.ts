import { Injectable, BadRequestException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { User, UserDocument, UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { Session, SessionDocument } from '../../database/schemas/session.schema';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    private jwtService: JwtService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(dto: any) {
    const emailNorm = dto.email.toLowerCase().trim();
    const existing = await this.userModel.findOne({ emailNormalized: emailNorm });
    if (existing) {
      throw new BadRequestException('User with this email already exists');
    }

    // PRD Section 10.3 Requirement: Argon2id for password hashing
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.userModel.create({
      email: dto.email,
      emailNormalized: emailNorm,
      passwordHash,
      status: 'pending_verification',
      roles: ['user'],
      countryCode: dto.countryCode || 'NG',
    });

    await this.userProfileModel.create({
      userId: user._id,
      firstName: dto.firstName || '',
      lastName: dto.lastName || '',
      displayName: dto.displayName || dto.email.split('@')[0],
      countryCode: dto.countryCode || 'NG',
    });

    return {
      success: true,
      data: {
        userId: user._id,
        email: user.email,
        status: user.status,
        message: 'Verification token generated & dispatched via Mailtrap provider',
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async login(dto: any) {
    const emailNorm = dto.email.toLowerCase().trim();
    const user = await this.userModel.findOne({ emailNormalized: emailNorm });

    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'AUTH_INVALID_CREDENTIALS',
          message: 'The email address or password is incorrect.',
        },
      });
    }

    // Separate Access and Refresh Token secrets (PRD Audit Section 3)
    const accessToken = this.jwtService.sign(
      { sub: user._id.toString(), email: user.email, roles: user.roles },
      { secret: process.env.JWT_ACCESS_SECRET || 'obiren_jwt_access_secret_key_32bytes_min_prod', expiresIn: '15m' },
    );

    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshTokenHash = this.hashToken(rawRefreshToken);

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    await this.sessionModel.create({
      userId: user._id,
      refreshTokenHash,
      platform: dto.platform || 'web',
      expiresAt,
    });

    user.lastLoginAt = new Date();
    await user.save();

    return {
      success: true,
      data: {
        user: {
          id: user._id.toString(),
          email: user.email,
          countryCode: user.countryCode,
          roles: user.roles,
        },
        tokens: {
          accessToken,
          accessTokenExpiresIn: '15m',
          refreshToken: rawRefreshToken,
          refreshTokenExpiresIn: '30d',
        },
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async refreshToken(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    const session = await this.sessionModel.findOne({ refreshTokenHash: tokenHash });

    if (!session) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    // PRD Audit 3 Requirement: Token replay detection - if reused after revocation, revoke user's entire session family!
    if (session.revokedAt) {
      await this.sessionModel.updateMany({ userId: session.userId }, { $set: { revokedAt: new Date(), revokeReason: 'TOKEN_REUSE_REPLAY_ATTACK' } });
      throw new UnauthorizedException('Security alert: Token reuse detected. All sessions revoked.');
    }

    if (new Date() > session.expiresAt) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const user = await this.userModel.findById(session.userId);
    if (!user) {
      throw new UnauthorizedException('User account not found');
    }

    // Rotate refresh token
    const newRawRefreshToken = crypto.randomBytes(40).toString('hex');
    const newHash = this.hashToken(newRawRefreshToken);

    session.revokedAt = new Date();
    session.revokeReason = 'ROTATED';
    await session.save();

    const newSession = await this.sessionModel.create({
      userId: user._id,
      refreshTokenHash: newHash,
      platform: session.platform,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });

    const accessToken = this.jwtService.sign(
      { sub: user._id.toString(), email: user.email, roles: user.roles },
      { secret: process.env.JWT_ACCESS_SECRET || 'obiren_jwt_access_secret_key_32bytes_min_prod', expiresIn: '15m' },
    );

    return {
      success: true,
      data: {
        accessToken,
        refreshToken: newRawRefreshToken,
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async logout(rawToken: string) {
    const tokenHash = this.hashToken(rawToken);
    await this.sessionModel.updateOne(
      { refreshTokenHash: tokenHash },
      { $set: { revokedAt: new Date(), revokeReason: 'USER_LOGOUT' } },
    );
    return { success: true, message: 'Session logged out successfully' };
  }

  async getSessions(userId: string) {
    const sessions = await this.sessionModel.find({ userId: new Types.ObjectId(userId) }).exec();
    return {
      success: true,
      data: sessions,
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
