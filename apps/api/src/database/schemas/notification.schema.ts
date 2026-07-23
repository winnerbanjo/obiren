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

  @Prop({ required: true, unique: true })
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
