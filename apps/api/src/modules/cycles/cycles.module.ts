import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CyclesController, DailyLogsController } from './cycles.controller';
import { CyclesService } from './cycles.service';
import { Cycle, CycleSchema, DailyLog, DailyLogSchema } from '../../database/schemas/cycle.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cycle.name, schema: CycleSchema },
      { name: DailyLog.name, schema: DailyLogSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [CyclesController, DailyLogsController],
  providers: [CyclesService],
  exports: [CyclesService],
})
export class CyclesModule {}
