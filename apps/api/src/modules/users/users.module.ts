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
import { PrivacyJob, PrivacyJobSchema } from '../../database/schemas/privacy-job.schema';
import { Session, SessionSchema } from '../../database/schemas/session.schema';
import { DailyLog, DailyLogSchema } from '../../database/schemas/cycle.schema';
import { Pregnancy, PregnancySchema, PregnancyLog, PregnancyLogSchema } from '../../database/schemas/pregnancy.schema';
import { NotificationOutbox, NotificationOutboxSchema } from '../../database/schemas/notification.schema';
import { HealthVaultDoc, HealthVaultDocSchema } from '../../database/schemas/health-vault.schema';
import { GuardianContact, GuardianContactSchema, SafetyIncident, SafetyIncidentSchema } from '../../database/schemas/safety.schema';
import { Consultation, ConsultationSchema, Device, DeviceSchema, Message, MessageSchema } from '../../database/schemas/communications.schema';
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
      { name: PrivacyJob.name, schema: PrivacyJobSchema },
      { name: Session.name, schema: SessionSchema },
      { name: DailyLog.name, schema: DailyLogSchema },
      { name: Pregnancy.name, schema: PregnancySchema },
      { name: PregnancyLog.name, schema: PregnancyLogSchema },
      { name: NotificationOutbox.name, schema: NotificationOutboxSchema },
      { name: HealthVaultDoc.name, schema: HealthVaultDocSchema },
      { name: SafetyIncident.name, schema: SafetyIncidentSchema },
      { name: GuardianContact.name, schema: GuardianContactSchema },
      { name: Consultation.name, schema: ConsultationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: Device.name, schema: DeviceSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [UsersController, ConfigController, ConsentController],
  providers: [UsersService, ConsentService],
  exports: [UsersService],
})
export class UsersModule {}
