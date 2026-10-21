import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CareController } from './care.controller';
import { CareService } from './care.service';
import { SpecialistsController } from './specialists.controller';
import {
  BookingsController,
  ClinicianBookingsController,
  PaymentsController,
  PaystackWebhookController,
} from './bookings.controller';
import { BookingsService } from './bookings.service';
import {
  AvailabilitySlot,
  AvailabilitySlotSchema,
  Booking,
  BookingHold,
  BookingHoldSchema,
  BookingSchema,
  Clinician,
  ClinicianSchema,
  Payment,
  PaymentSchema,
  PaymentWebhookEvent,
  PaymentWebhookEventSchema,
} from '../../database/schemas/care.schema';
import { User, UserSchema } from '../../database/schemas/user.schema';
import { IdempotencyModule } from '../../common/idempotency/idempotency.module';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { PaystackProvider } from '../../common/payments/paystack.provider';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Clinician.name, schema: ClinicianSchema },
      { name: AvailabilitySlot.name, schema: AvailabilitySlotSchema },
      { name: BookingHold.name, schema: BookingHoldSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Payment.name, schema: PaymentSchema },
      { name: PaymentWebhookEvent.name, schema: PaymentWebhookEventSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtAuthModule,
    IdempotencyModule,
  ],
  controllers: [
    CareController,
    SpecialistsController,
    BookingsController,
    ClinicianBookingsController,
    PaymentsController,
    PaystackWebhookController,
  ],
  providers: [CareService, BookingsService, PaystackProvider],
  exports: [CareService, BookingsService],
})
export class CareModule {}
