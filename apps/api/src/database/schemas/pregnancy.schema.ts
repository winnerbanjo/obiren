import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PregnancyDocument = Pregnancy & Document;

@Schema({ timestamps: true, collection: 'pregnancies' })
export class Pregnancy {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({
    type: String,
    enum: ['active', 'completed', 'loss', 'terminated', 'archived'],
    default: 'active',
  })
  status: string;

  @Prop({ type: Date, required: true })
  estimatedDueDate: Date;

  @Prop({
    type: String,
    enum: ['last_menstrual_period', 'ultrasound', 'medical_professional', 'user_entered'],
    default: 'last_menstrual_period',
  })
  calculationSource: string;

  @Prop({ type: Date })
  lastMenstrualPeriod?: Date;

  @Prop({ type: Date })
  conceptionDate?: Date;

  @Prop({ type: Boolean, default: false })
  multiplePregnancy?: boolean;

  @Prop({ type: Boolean, default: false })
  highRiskFlag?: boolean;

  @Prop({ type: Date })
  endedAt?: Date;

  @Prop({ type: Number, default: 1 })
  schemaVersion: number;
}

export const PregnancySchema = SchemaFactory.createForClass(Pregnancy);
// PRD Audit 3: Partial Unique Index enforcing at most ONE active pregnancy per user at database level
PregnancySchema.index(
  { userId: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'active' },
    name: 'unique_active_pregnancy_per_user',
  },
);
PregnancySchema.index({ userId: 1, status: 1 });
