import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SafetyIncidentDocument = SafetyIncident & Document;

@Schema({ timestamps: true, collection: 'safety_incidents' })
export class SafetyIncident {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, enum: ['countdown', 'check_in', 'manual_alert'], default: 'manual_alert' })
  type: string;

  @Prop({ type: String, enum: ['active', 'cancelled', 'completed', 'triggered'], default: 'active' })
  status: string;

  @Prop({ type: Boolean, default: false })
  isTestMode: boolean;

  @Prop({ type: String })
  gpsCoordinates: string;

  @Prop({ type: Date, default: Date.now })
  triggeredAt: Date;

  @Prop({ type: Date })
  cancelledAt?: Date;

  @Prop({ type: [Types.ObjectId], default: [] })
  trustedContactIds: Types.ObjectId[];

  @Prop({ type: [String], default: [] })
  dispatchedNotificationIds: string[];
}

export const SafetyIncidentSchema = SchemaFactory.createForClass(SafetyIncident);
SafetyIncidentSchema.index({ userId: 1, createdAt: -1 });
SafetyIncidentSchema.index({ status: 1, createdAt: -1 });
