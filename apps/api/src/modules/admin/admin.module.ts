import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLog, AuditLogSchema } from '../../database/schemas/audit-log.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { Pregnancy, PregnancySchema } from '../../database/schemas/pregnancy.schema';
import { DirectoryService, DirectoryServiceSchema } from '../../database/schemas/directory.schema';
import { Clinician, ClinicianSchema } from '../../database/schemas/care.schema';
import { Consultation, ConsultationSchema } from '../../database/schemas/communications.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { SafetyModule } from '../safety/safety.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Pregnancy.name, schema: PregnancySchema },
      { name: DirectoryService.name, schema: DirectoryServiceSchema },
      { name: Clinician.name, schema: ClinicianSchema },
      { name: Consultation.name, schema: ConsultationSchema },
    ]),
    JwtAuthModule,
    SafetyModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
