import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A support request raised by an account holder. Tickets intentionally carry no
 * clinical fields: the subject/message are free text, and health records are
 * never attached server-side. Nothing here is a medical channel.
 */
export type SupportTicketDocument = SupportTicket & Document;

@Schema({ timestamps: true, collection: 'support_tickets' })
export class SupportTicket {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  /** Human-readable reference returned to the client, e.g. `SUP-7F3K2A`. */
  @Prop({ type: String, required: true, unique: true })
  reference: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 160 })
  subject: string;

  @Prop({
    type: String,
    required: true,
    enum: ['account', 'privacy', 'billing', 'technical', 'safety', 'other'],
    default: 'other',
  })
  category: string;

  @Prop({ type: String, required: true, maxlength: 4000 })
  message: string;

  @Prop({ type: String, required: true, enum: ['open', 'in_progress', 'resolved', 'closed'], default: 'open' })
  status: string;

  @Prop({
    type: [
      {
        authorRole: { type: String, enum: ['user', 'support'], required: true },
        body: { type: String, required: true, maxlength: 4000 },
        createdAt: { type: Date, default: Date.now },
      },
    ],
    default: [],
  })
  replies: Array<{ authorRole: string; body: string; createdAt: Date }>;

  @Prop({ type: Date }) resolvedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) handledByUserId?: Types.ObjectId;
}

export const SupportTicketSchema = SchemaFactory.createForClass(SupportTicket);
SupportTicketSchema.index({ userId: 1, createdAt: -1 }, { name: 'idx_support_ticket_owner_created' });
SupportTicketSchema.index({ status: 1, createdAt: -1 }, { name: 'idx_support_ticket_status_created' });
