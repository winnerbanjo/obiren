import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import {
  InAppNotification,
  InAppNotificationSchema,
  NotificationOutbox,
  NotificationOutboxSchema,
} from '../../database/schemas/notification.schema';
import { Booking, BookingSchema } from '../../database/schemas/care.schema';
import { Clinician, ClinicianSchema } from '../../database/schemas/care.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: NotificationOutbox.name, schema: NotificationOutboxSchema },
      { name: InAppNotification.name, schema: InAppNotificationSchema },
      { name: Booking.name, schema: BookingSchema },
      { name: Clinician.name, schema: ClinicianSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
