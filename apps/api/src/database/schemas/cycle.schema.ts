import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CycleDocument = Cycle & Document;

@Schema({ timestamps: true, collection: 'cycles' })
export class Cycle {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  startedAt: Date;

  @Prop({ type: Date })
  endedAt?: Date;

  @Prop({ type: Date })
  periodEndedAt?: Date;

  @Prop({ type: Number })
  cycleLength?: number;

  @Prop({ type: Number })
  periodLength?: number;

  @Prop({ type: String, enum: ['user_logged', 'imported', 'admin_corrected'], default: 'user_logged' })
  source: string;

  @Prop({ type: String, enum: ['active', 'completed', 'corrected', 'deleted'], default: 'active' })
  status: string;

  @Prop({ type: String })
  notes?: string;

  @Prop({ type: Number, default: 1 })
  schemaVersion: number;
}

export const CycleSchema = SchemaFactory.createForClass(Cycle);
// PRD Audit 4: Partial Unique Index enforcing at most ONE active menstrual cycle per user at database level
CycleSchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'unique_active_cycle_per_user',
  },
);
CycleSchema.index({ userId: 1, startedAt: -1 });
CycleSchema.index({ userId: 1, status: 1 });

export type DailyLogDocument = DailyLog & Document;

@Schema({ timestamps: true, collection: 'daily_logs' })
export class DailyLog {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true }) // Format: YYYY-MM-DD
  date: string;

  @Prop({ type: String, default: 'UTC' })
  timeZone: string;

  @Prop({
    type: {
      level: { type: String, enum: ['none', 'spotting', 'light', 'medium', 'heavy'], default: 'none' },
      clots: Boolean,
    },
  })
  bleeding?: {
    level: string;
    clots?: boolean;
  };

  @Prop({
    type: {
      level: Number,
      locations: [String],
    },
  })
  pain?: {
    level: number;
    locations: string[];
  };

  @Prop({ type: [String], default: [] })
  moods: string[];

  @Prop({ type: [String], default: [] })
  symptoms: string[];

  @Prop({
    type: {
      occurred: Boolean,
      protection: String,
    },
  })
  sexualActivity?: {
    occurred?: boolean;
    protection?: string;
  };

  @Prop({ type: String })
  notes?: string;
}

export const DailyLogSchema = SchemaFactory.createForClass(DailyLog);
DailyLogSchema.index({ userId: 1, date: 1 }, { unique: true });
