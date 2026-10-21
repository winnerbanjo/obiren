import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SafetyController } from './safety.controller';
import { SafetyResourcesController } from './safety-resources.controller';
import { SafetyService } from './safety.service';
import { SafetyResourcesService } from './safety-resources.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { GuardianContact, GuardianContactSchema, GuardianInvite, GuardianInviteSchema, LocationSession, LocationSessionSchema, SafetyDeliveryAttempt, SafetyDeliveryAttemptSchema, SafetyIncident, SafetyIncidentSchema } from '../../database/schemas/safety.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { SafetyPin, SafetyPinSchema } from '../../database/schemas/safety-pin.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { AuditLog, AuditLogSchema } from '../../database/schemas/audit-log.schema';
import { UserProfile, UserProfileSchema } from '../../database/schemas/user.schema';
import { EmergencyResourceReview, EmergencyResourceReviewSchema } from '../../database/schemas/emergency-resource-review.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SafetyIncident.name, schema: SafetyIncidentSchema },
      { name: SafetyDeliveryAttempt.name, schema: SafetyDeliveryAttemptSchema },
      { name: GuardianContact.name, schema: GuardianContactSchema },
      { name: GuardianInvite.name, schema: GuardianInviteSchema },
      { name: LocationSession.name, schema: LocationSessionSchema },
      { name: SafetyPin.name, schema: SafetyPinSchema },
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: EmergencyResourceReview.name, schema: EmergencyResourceReviewSchema },
    ]),
    JwtAuthModule,
    NotificationsModule,
  ],
  controllers: [SafetyController, SafetyResourcesController],
  providers: [SafetyService, SafetyResourcesService],
  exports: [SafetyResourcesService],
})
export class SafetyModule {}
