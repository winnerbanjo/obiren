import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareController } from './care.controller';
import { CareService } from './care.service';
import { AvailabilitySlot, AvailabilitySlotSchema, BookingHold, BookingHoldSchema, Clinician, ClinicianSchema } from '../../database/schemas/care.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [MongooseModule.forFeature([
    { name: Clinician.name, schema: ClinicianSchema },
    { name: AvailabilitySlot.name, schema: AvailabilitySlotSchema },
    { name: BookingHold.name, schema: BookingHoldSchema },
  ]), JwtAuthModule],
  controllers: [CareController],
  providers: [CareService],
  exports: [CareService],
})
export class CareModule {}
