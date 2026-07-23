import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type HealthVaultDocDocument = HealthVaultDoc & Document;

@Schema({ timestamps: true, collection: 'health_vault_documents' })
export class HealthVaultDoc {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  title: string;

  @Prop({
    type: String,
    enum: ['laboratory_result', 'prescription', 'ultrasound', 'scan', 'referral', 'vaccination', 'medical_note', 'other'],
    default: 'medical_note',
  })
  documentType: string;

  @Prop({ required: true, unique: true })
  cloudinaryPublicId: string;

  @Prop({ type: Date })
  dateOfRecord?: Date;

  @Prop({ type: String })
  healthcareProviderName?: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, enum: ['private', 'shared_with_trusted_circle', 'shared_with_professional'], default: 'private' })
  accessLevel: string;

  @Prop({ type: String })
  encryptedMetadata?: string;

  @Prop({ type: String, enum: ['active', 'archived', 'deleted'], default: 'active' })
  status: string;
}

export const HealthVaultDocSchema = SchemaFactory.createForClass(HealthVaultDoc);
HealthVaultDocSchema.index({ userId: 1, createdAt: -1 });
HealthVaultDocSchema.index({ cloudinaryPublicId: 1 }, { unique: true });

export type HealthVaultAccessLogDocument = HealthVaultAccessLog & Document;

@Schema({ timestamps: true, collection: 'health_vault_access_logs' })
export class HealthVaultAccessLog {
  @Prop({ type: Types.ObjectId, ref: 'HealthVaultDoc', required: true, index: true })
  documentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  accessedByUserId: Types.ObjectId;

  @Prop({ required: true })
  action: string;

  @Prop({ type: String })
  reason?: string;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ type: Date, default: Date.now })
  accessedAt: Date;
}

export const HealthVaultAccessLogSchema = SchemaFactory.createForClass(HealthVaultAccessLog);
