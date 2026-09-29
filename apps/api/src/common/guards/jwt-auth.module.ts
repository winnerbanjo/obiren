import { Global, Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { env } from '../../config/env.validation';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { JwtAuthGuard } from './jwt-auth.guard';

/**
 * Registers the dependencies required by JwtAuthGuard (User model + JWT
 * service) and exports the guard. Feature modules import this and use
 * `@UseGuards(JwtAuthGuard)`.
 */
// Global so the DB-validating guard (and its User-model dependency) can be
// instantiated by @UseGuards in ANY feature module without re-imports.
@Global()
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    JwtModule.register({
      secret: env().jwtAccessSecret,
      signOptions: { expiresIn: '15m' },
    }),
  ],
  providers: [JwtAuthGuard],
  exports: [JwtAuthGuard, JwtModule, MongooseModule],
})
export class JwtAuthModule {}
