import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { User, UserSchema, UserProfile, UserProfileSchema } from '../../database/schemas/user.schema';
import { Session, SessionSchema } from '../../database/schemas/session.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: Session.name, schema: SessionSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_ACCESS_SECRET || 'obiren_jwt_access_secret_key_32bytes_min_prod',
      signOptions: { expiresIn: '15m' },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
