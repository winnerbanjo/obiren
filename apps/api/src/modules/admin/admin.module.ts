import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLog, AuditLogSchema } from '../../database/schemas/audit-log.schema';
import { User, UserProfile, UserProfileSchema, UserSchema } from '../../database/schemas/user.schema';
import { Pregnancy, PregnancySchema } from '../../database/schemas/pregnancy.schema';
import { DirectoryService, DirectoryServiceSchema } from '../../database/schemas/directory.schema';
import { Booking, BookingSchema, Clinician, ClinicianSchema, Payment, PaymentSchema } from '../../database/schemas/care.schema';
import { Consultation, ConsultationSchema } from '../../database/schemas/communications.schema';
import { SafetyIncident, SafetyIncidentSchema } from '../../database/schemas/safety.schema';
import { SupportTicket, SupportTicketSchema } from '../../database/schemas/support.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { AuthModule } from '../auth/auth.module';
import { SafetyModule } from '../safety/safety.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Pregnancy.name, schema: PregnancySchema },
      { name: DirectoryService.name, schema: DirectoryServiceSchema },
      { name: Clinician.name, schema: ClinicianSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: SafetyIncident.name, schema: SafetyIncidentSchema },
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
    JwtAuthModule,
    AuthModule,
    SafetyModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
