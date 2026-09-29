import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WaitlistEntryDocument = WaitlistEntry & Document;

/**
 * Durable waitlist storage (Phase 13). Replaces the previous in-memory
 * Next.js route array which reset on every cold start.
 */
@Schema({ timestamps: true, collection: 'waitlist_entries' })
export class WaitlistEntry {
  @Prop({ required: true, lowercase: true, trim: true })
  normalizedEmail: string;

  /** Display form of the email as provided. */
  @Prop({ required: true })
  email: string;

  @Prop({ type: String })
  firstName?: string;

  @Prop({ type: String, default: 'web' })
  source: string;

  @Prop({ type: String })
  market?: string;

  @Prop({ type: String })
  referral?: string;

  @Prop({
    type: String,
    enum: ['pending', 'invited', 'active', 'unsubscribed'],
    default: 'pending',
  })
  status: string;
}

export const WaitlistEntrySchema = SchemaFactory.createForClass(WaitlistEntry);
WaitlistEntrySchema.index({ normalizedEmail: 1 }, { unique: true, name: 'uniq_waitlist_normalizedEmail' });
WaitlistEntrySchema.index({ createdAt: -1 });
WaitlistEntrySchema.index({ status: 1, createdAt: -1 });
