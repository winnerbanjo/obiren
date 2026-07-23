import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationOutbox, NotificationOutboxSchema } from '../../database/schemas/notification.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: NotificationOutbox.name, schema: NotificationOutboxSchema }]),
  ],
  controllers: [NotificationsController],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
