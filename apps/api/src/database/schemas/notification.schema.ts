import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationOutboxDocument = NotificationOutbox & Document;

@Schema({ timestamps: true, collection: 'notification_outbox' })
export class NotificationOutbox {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  userId?: Types.ObjectId;

  @Prop({
    type: {
      email: String,
      phoneNumber: String,
    },
    required: true,
  })
  recipient: {
    email?: string;
    phoneNumber?: string;
  };

  @Prop({ required: true })
  type: string;

  @Prop({ required: true })
  category: string;

  @Prop({ type: String, enum: ['in_app', 'email', 'whatsapp'], required: true })
  channel: string;

  @Prop({ required: true })
  templateKey: string;

  @Prop({ type: Object, default: {} })
  templateData: Record<string, any>;

  @Prop({ type: Date, required: true, index: true })
  scheduledFor: Date;

  @Prop({
    type: String,
    enum: ['pending', 'processing', 'sent', 'delivered', 'read', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  })
  status: string;

  @Prop({ type: Number, default: 0 })
  attemptCount: number;

  @Prop({ type: Number, default: 3 })
  maximumAttempts: number;

  @Prop({ type: String })
  providerMessageId?: string;

  @Prop({ type: String })
  providerStatus?: string;

  @Prop({ type: Date })
  deliveredAt?: Date;

  @Prop({ type: Date })
  readAt?: Date;

  @Prop({ required: true })
  idempotencyKey: string;

  @Prop({ type: Date })
  lockedUntil?: Date;

  @Prop({ type: String })
  workerId?: string;

  @Prop({ type: Date })
  sentAt?: Date;

  @Prop({ type: Date })
  failedAt?: Date;
}

export const NotificationOutboxSchema = SchemaFactory.createForClass(NotificationOutbox);
NotificationOutboxSchema.index({ idempotencyKey: 1 }, { unique: true });
NotificationOutboxSchema.index({ status: 1, scheduledFor: 1, lockedUntil: 1 });
NotificationOutboxSchema.index({ userId: 1, createdAt: -1 });

/**
 * In-app notification feed (Doctor Portal today, patient app-safe copy).
 *
 * Distinct from `notification_outbox`, which tracks external delivery
 * attempts. An in-app event is always recorded, even when every external
 * channel is unconfigured, so the provider-side experience never depends on
 * email/SMS being live.
 *
 * Copy must never contain symptoms, diagnoses or other health detail: it is
 * safe on a locked screen and in a shared browser.
 */
export type InAppNotificationDocument = InAppNotification & Document;
@Schema({ timestamps: true, collection: 'in_app_notifications' })
export class InAppNotification {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, maxlength: 60 }) type: string;
  @Prop({ required: true, maxlength: 140 }) title: string;
  @Prop({ required: true, maxlength: 400 }) body: string;
  @Prop({ type: String, maxlength: 300 }) deepLink?: string;
  @Prop({ type: String, maxlength: 40 }) objectType?: string;
  @Prop({ type: String, maxlength: 80 }) objectId?: string;
  @Prop({ type: String, maxlength: 80, unique: true, sparse: true }) dedupeKey?: string;
  @Prop({ type: Date }) readAt?: Date;
}
export const InAppNotificationSchema = SchemaFactory.createForClass(InAppNotification);
InAppNotificationSchema.index({ userId: 1, createdAt: -1 }, { name: 'idx_inapp_user_created' });
InAppNotificationSchema.index({ userId: 1, readAt: 1 }, { name: 'idx_inapp_user_read' });
