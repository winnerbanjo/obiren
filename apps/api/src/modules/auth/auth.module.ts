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
import { AdminAccess, AdminAccessSchema } from '../../database/schemas/admin-access.schema';
import { AuditLog, AuditLogSchema } from '../../database/schemas/audit-log.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: Session.name, schema: SessionSchema },
      { name: MfaCredential.name, schema: MfaCredentialSchema },
      { name: AdminAccess.name, schema: AdminAccessSchema },
      // Refused console sign-ins are recorded with the address that was tried.
      { name: AuditLog.name, schema: AuditLogSchema },
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
