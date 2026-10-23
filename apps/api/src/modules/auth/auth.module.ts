import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../../config/env.validation';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleTokenVerifier } from './google-token-verifier';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { User, UserSchema, UserProfile, UserProfileSchema } from '../../database/schemas/user.schema';
import { Session, SessionSchema } from '../../database/schemas/session.schema';
import { MfaCredential, MfaCredentialSchema } from '../../database/schemas/mfa.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: Session.name, schema: SessionSchema },
      { name: MfaCredential.name, schema: MfaCredentialSchema },
    ]),
    JwtModule.register({
      secret: env().jwtAccessSecret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard, GoogleTokenVerifier],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
