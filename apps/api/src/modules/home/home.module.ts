import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HomeController } from './home.controller';
import { CyclesService } from '../cycles/cycles.service';
import { Cycle, CycleSchema, DailyLog, DailyLogSchema } from '../../database/schemas/cycle.schema';
import { Pregnancy, PregnancySchema, PregnancyLog, PregnancyLogSchema } from '../../database/schemas/pregnancy.schema';
import { UserProfile, UserProfileSchema } from '../../database/schemas/user.schema';
import { PregnancyService } from '../pregnancy/pregnancy.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cycle.name, schema: CycleSchema },
      { name: DailyLog.name, schema: DailyLogSchema },
      { name: Pregnancy.name, schema: PregnancySchema },
      { name: PregnancyLog.name, schema: PregnancyLogSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [HomeController],
  providers: [CyclesService, PregnancyService],
})
export class HomeModule {}
