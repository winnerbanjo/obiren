import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { PregnancyController } from './pregnancy.controller';
import { PregnancyService } from './pregnancy.service';
import { Pregnancy, PregnancySchema } from '../../database/schemas/pregnancy.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Pregnancy.name, schema: PregnancySchema }]),
    AuthModule,
  ],
  controllers: [PregnancyController],
  providers: [PregnancyService],
  exports: [PregnancyService],
})
export class PregnancyModule {}
