import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { SafetyIncident, SafetyIncidentSchema } from '../../database/schemas/safety.schema';
import { SafetyPin, SafetyPinSchema } from '../../database/schemas/safety-pin.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SafetyIncident.name, schema: SafetyIncidentSchema },
      { name: SafetyPin.name, schema: SafetyPinSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
