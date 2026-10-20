import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersController } from './users.controller';
import { ConfigController } from './config.controller';
import { ConsentController } from './consent.controller';
import { UsersService } from './users.service';
import { User, UserSchema, UserProfile, UserProfileSchema } from '../../database/schemas/user.schema';
import { Onboarding, OnboardingSchema } from '../../database/schemas/onboarding.schema';
import { Cycle, CycleSchema } from '../../database/schemas/cycle.schema';
import { ConsentEvent, ConsentEventSchema } from '../../database/schemas/consent.schema';
import { ConsentService } from './consent.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: Onboarding.name, schema: OnboardingSchema },
      { name: Cycle.name, schema: CycleSchema },
      { name: ConsentEvent.name, schema: ConsentEventSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [UsersController, ConfigController, ConsentController],
  providers: [UsersService, ConsentService],
  exports: [UsersService],
})
export class UsersModule {}
