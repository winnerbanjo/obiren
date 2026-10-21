import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CommunicationsController } from './communications.controller';
import { CommunicationsService } from './communications.service';
import { NotificationOutbox, NotificationOutboxSchema } from '../../database/schemas/notification.schema';
import { Consultation, ConsultationSchema, Device, DeviceSchema, HealthShare, HealthShareSchema, Message, MessageSchema, NotificationPreference, NotificationPreferenceSchema } from '../../database/schemas/communications.schema';
import { UserProfile, UserProfileSchema } from '../../database/schemas/user.schema';
import { Cycle, CycleSchema, DailyLog, DailyLogSchema } from '../../database/schemas/cycle.schema';
import { Pregnancy, PregnancySchema } from '../../database/schemas/pregnancy.schema';
import { ConsentEvent, ConsentEventSchema } from '../../database/schemas/consent.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [MongooseModule.forFeature([
    { name: NotificationOutbox.name, schema: NotificationOutboxSchema },
    { name: NotificationPreference.name, schema: NotificationPreferenceSchema },
    { name: HealthShare.name, schema: HealthShareSchema },
    { name: Consultation.name, schema: ConsultationSchema },
    { name: Message.name, schema: MessageSchema },
    { name: Device.name, schema: DeviceSchema },
    { name: UserProfile.name, schema: UserProfileSchema },
    { name: Cycle.name, schema: CycleSchema },
    { name: DailyLog.name, schema: DailyLogSchema },
    { name: Pregnancy.name, schema: PregnancySchema },
    { name: ConsentEvent.name, schema: ConsentEventSchema },
  ]), JwtAuthModule],
  controllers: [CommunicationsController],
  providers: [CommunicationsService],
})
export class CommunicationsModule {}
