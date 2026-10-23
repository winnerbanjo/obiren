import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PrivacyJobDocument = PrivacyJob & Document;
@Schema({ timestamps: true, collection: 'privacy_jobs' })
export class PrivacyJob {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: String, enum: ['export', 'deletion'], required: true }) type: string;
  @Prop({ type: String, enum: ['requested', 'processing', 'ready', 'completed', 'cancelled', 'failed'], default: 'requested' }) status: string;
  @Prop({ type: Date, required: true }) requestedAt: Date;
  @Prop({ type: Date }) availableAt?: Date;
  @Prop({ type: Date }) completedAt?: Date;
  @Prop({ type: String }) failureCode?: string;
  @Prop({ type: Date }) expiresAt?: Date;
}
export const PrivacyJobSchema = SchemaFactory.createForClass(PrivacyJob);
PrivacyJobSchema.index({ userId: 1, type: 1, requestedAt: -1 });
PrivacyJobSchema.index({ status: 1, availableAt: 1 });
