import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OnboardingDocument = Onboarding & Document;

@Schema({ timestamps: true, collection: 'onboarding' })
export class Onboarding {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Number, required: true, min: 1, max: 8, default: 1 })
  step: number;

  @Prop({ type: String, enum: ['CYCLE_TRACKING', 'PREGNANCY', 'FERTILITY', 'GENERAL_WELLNESS'] })
  objective?: string;

  @Prop({ type: String })
  lastMenstrualPeriod?: string;

  @Prop({ type: Number, min: 20, max: 45 })
  cycleLengthDays?: number;

  @Prop({ type: Number, min: 1, max: 15 })
  bleedingDays?: number;

  @Prop({ type: [String], default: [] })
  conditions: string[];

  @Prop({ type: [String], default: [] })
  concerns: string[];

  @Prop({ type: Boolean })
  notificationsEnabled?: boolean;

  @Prop({ type: String, enum: ['in_progress', 'completed'], default: 'in_progress' })
  status: string;

  @Prop({ type: Date })
  completedAt?: Date;
}

export const OnboardingSchema = SchemaFactory.createForClass(Onboarding);
OnboardingSchema.index({ userId: 1 }, { unique: true, name: 'uniq_onboarding_userId' });
