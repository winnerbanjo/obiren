import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PregnancyDocument = Pregnancy & Document;

@Schema({ timestamps: true, collection: 'pregnancies' })
export class Pregnancy {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['active', 'completed', 'loss', 'terminated', 'archived'], default: 'active' })
  status: string;

  @Prop({ type: Date, required: true })
  estimatedDueDate: Date;

  @Prop({ type: Date })
  clinicianConfirmedDueDate?: Date;

  @Prop({ type: String, enum: ['last_menstrual_period', 'ultrasound', 'medical_professional', 'user_entered'] })
  clinicianDueDateSource?: string;

  @Prop({ type: String, enum: ['last_menstrual_period', 'ultrasound', 'medical_professional', 'user_entered'], default: 'last_menstrual_period' })
  calculationSource: string;

  @Prop({ type: String, enum: ['certain', 'approximate', 'unknown'], default: 'approximate' })
  dateConfidence: string;

  @Prop({ type: [{ previousDate: Date, nextDate: Date, source: String, recordedAt: Date }], default: [] })
  dueDateHistory: Array<{ previousDate: Date; nextDate: Date; source: string; recordedAt: Date }>;

  @Prop({ type: Date })
  lastMenstrualPeriod?: Date;

  @Prop({ type: Date })
  conceptionDate?: Date;

  @Prop({ type: Boolean, default: false })
  multiplePregnancy?: boolean;

  @Prop({ type: Boolean, default: false })
  highRiskFlag?: boolean;

  @Prop({ type: String, default: 'UTC' })
  timeZone: string;

  @Prop({ type: Date })
  endedAt?: Date;

  @Prop({ type: String, enum: ['completed', 'loss', 'terminated', 'archived'] })
  endReason?: string;

  @Prop({ type: [Object], default: [] })
  timelineEvents: Array<{ type: string; date: Date; details?: string }>;

  @Prop({ type: [{ startedAt: Date, completedAt: Date, count: Number, durationMinutes: Number }], default: [] })
  kickSessions: Array<{ startedAt: Date; completedAt: Date; count: number; durationMinutes: number }>;

  @Prop({ type: Number, default: 1, min: 1 })
  version: number;

  @Prop({ type: Number, default: 1 })
  schemaVersion: number;
}

export const PregnancySchema = SchemaFactory.createForClass(Pregnancy);
PregnancySchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' }, name: 'unique_active_pregnancy_per_user' },
);
PregnancySchema.index({ userId: 1, status: 1 });

export type PregnancyLogDocument = PregnancyLog & Document;

@Schema({ timestamps: true, collection: 'pregnancy_logs' })
export class PregnancyLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Pregnancy', required: true })
  pregnancyId: Types.ObjectId;

  @Prop({ type: String, required: true })
  date: string;

  @Prop({ type: String, default: 'UTC' })
  timeZone: string;

  @Prop({ type: String, enum: ['none', 'mild', 'moderate', 'severe'] })
  nausea?: string;

  @Prop({ type: [String], default: [] })
  symptoms: string[];

  @Prop({ type: String, maxlength: 40 })
  mood?: string;

  @Prop({ type: String, maxlength: 40 })
  energy?: string;

  @Prop({ type: Number, min: 0, max: 30 })
  water?: number;

  @Prop({ type: [String], default: [] })
  vitamins: string[];

  @Prop({ type: [String], default: [] })
  nutrition: string[];

  @Prop({ type: [String], default: [] })
  selfCare: string[];

  @Prop({ type: String, enum: ['normal', 'reduced', 'absent', 'not_assessed'], default: 'not_assessed' })
  fetalMovement: string;

  @Prop({ type: String })
  notesEncrypted?: string;

  @Prop({ type: String })
  notesIv?: string;

  @Prop({ type: String })
  notesAuthTag?: string;

  @Prop({ type: String })
  notesKeyId?: string;

  @Prop({ type: Number, default: 1, min: 1 })
  version: number;
}

export const PregnancyLogSchema = SchemaFactory.createForClass(PregnancyLog);
PregnancyLogSchema.index({ pregnancyId: 1, date: 1 }, { unique: true, name: 'uniq_pregnancy_log_parent_date' });
PregnancyLogSchema.index({ userId: 1, date: 1 }, { name: 'idx_pregnancy_log_user_date' });
