import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { SafetyIncident, SafetyIncidentSchema } from '../../database/schemas/safety.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SafetyIncident.name, schema: SafetyIncidentSchema },
      { name: User.name, schema: UserSchema },
    ]),
    AuthModule,
  ],
  controllers: [SafetyController],
  providers: [SafetyService],
  exports: [SafetyService],
})
export class SafetyModule {}
