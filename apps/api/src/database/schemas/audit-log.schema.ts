import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type AuditLogDocument = AuditLog & Document;

@Schema({ timestamps: true, collection: 'audit_logs' })
export class AuditLog {
  @Prop({ type: Types.ObjectId, ref: 'User', index: true })
  actorUserId?: Types.ObjectId;

  @Prop({ required: true })
  actorRole: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop({ required: true })
  module: string;

  @Prop({ type: String })
  targetResourceId?: string;

  @Prop({ type: String })
  details: string;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ type: Date, default: Date.now, index: true })
  timestamp: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);
AuditLogSchema.index({ actorUserId: 1, timestamp: -1 });
AuditLogSchema.index({ module: 1, timestamp: -1 });
