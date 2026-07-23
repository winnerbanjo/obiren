import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuditLog, AuditLogSchema } from '../../database/schemas/audit-log.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { Pregnancy, PregnancySchema } from '../../database/schemas/pregnancy.schema';
import { DirectoryService, DirectoryServiceSchema } from '../../database/schemas/directory.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: AuditLog.name, schema: AuditLogSchema },
      { name: User.name, schema: UserSchema },
      { name: Pregnancy.name, schema: PregnancySchema },
      { name: DirectoryService.name, schema: DirectoryServiceSchema },
    ]),
    AuthModule,
  ],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
