import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export const CONSENT_PURPOSES = [
  'terms_of_service_acknowledgement',
  'privacy_notice_acknowledgement',
  'health_data_processing',
  'care_communications',
  'health_sharing',
  'location_sharing',
  'marketing',
] as const;

export const CONSENT_SOURCES = ['onboarding', 'settings', 'feature_action'] as const;

export type ConsentDocument = ConsentEvent & Document;

@Schema({ timestamps: true, collection: 'consent_events', versionKey: false })
export class ConsentEvent {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, immutable: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: CONSENT_PURPOSES, required: true, immutable: true })
  purpose: (typeof CONSENT_PURPOSES)[number];

  @Prop({ type: String, required: true, trim: true, maxlength: 40, immutable: true })
  policyVersion: string;

  @Prop({ type: Boolean, required: true, immutable: true })
  granted: boolean;

  @Prop({ type: String, enum: CONSENT_SOURCES, required: true, immutable: true })
  source: (typeof CONSENT_SOURCES)[number];

  @Prop({ type: Date, default: Date.now, immutable: true })
  recordedAt: Date;
}

export const ConsentEventSchema = SchemaFactory.createForClass(ConsentEvent);
ConsentEventSchema.index({ userId: 1, purpose: 1, recordedAt: -1 }, { name: 'idx_consent_user_purpose_recorded' });
