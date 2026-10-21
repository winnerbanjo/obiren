import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { BriefsController, ClinicianSharedBriefsController } from './briefs.controller';
import { BriefsService } from './briefs.service';
import { HealthBrief, HealthBriefSchema } from '../../database/schemas/briefs.schema';
import { Cycle, CycleSchema, DailyLog, DailyLogSchema } from '../../database/schemas/cycle.schema';
import { Pregnancy, PregnancySchema } from '../../database/schemas/pregnancy.schema';
import { ConsentEvent, ConsentEventSchema } from '../../database/schemas/consent.schema';
import { Clinician, ClinicianSchema } from '../../database/schemas/care.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HealthBrief.name, schema: HealthBriefSchema },
      { name: Cycle.name, schema: CycleSchema },
      { name: DailyLog.name, schema: DailyLogSchema },
      { name: Pregnancy.name, schema: PregnancySchema },
      { name: ConsentEvent.name, schema: ConsentEventSchema },
      { name: Clinician.name, schema: ClinicianSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [BriefsController, ClinicianSharedBriefsController],
  providers: [BriefsService],
  exports: [BriefsService],
})
export class BriefsModule {}
