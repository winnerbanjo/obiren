import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CyclesController, DailyLogsController } from './cycles.controller';
import { CyclesService } from './cycles.service';
import { Cycle, CycleSchema, DailyLog, DailyLogSchema } from '../../database/schemas/cycle.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Cycle.name, schema: CycleSchema },
      { name: DailyLog.name, schema: DailyLogSchema },
    ]),
    AuthModule,
  ],
  controllers: [CyclesController, DailyLogsController],
  providers: [CyclesService],
  exports: [CyclesService],
})
export class CyclesModule {}
