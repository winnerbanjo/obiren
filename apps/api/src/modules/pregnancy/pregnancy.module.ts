import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PregnancyController, PregnancyLogsController } from './pregnancy.controller';
import { PregnancyService } from './pregnancy.service';
import { Pregnancy, PregnancySchema, PregnancyLog, PregnancyLogSchema } from '../../database/schemas/pregnancy.schema';
import { UserProfile, UserProfileSchema } from '../../database/schemas/user.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Pregnancy.name, schema: PregnancySchema },
      { name: PregnancyLog.name, schema: PregnancyLogSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [PregnancyController, PregnancyLogsController],
  providers: [PregnancyService],
  exports: [PregnancyService],
})
export class PregnancyModule {}
