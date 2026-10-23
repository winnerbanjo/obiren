import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A generated, traceable health brief shared with one care professional.
 *
 * The snapshot is deterministic: the same records and range always produce the
 * same content hash, so a clinician can tell whether the brief changed. Free-
 * text notes are never included.
 */
export type HealthBriefDocument = HealthBrief & Document;

@Schema({ timestamps: true, collection: 'health_briefs' })
export class HealthBrief {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  ownerUserId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  recipientUserId: Types.ObjectId;

  @Prop({ type: [String], required: true })
  scopes: string[];

  @Prop({ type: String, required: true })
  evidenceFrom: string;

  @Prop({ type: String, required: true })
  evidenceTo: string;

  @Prop({ type: Object, required: true })
  snapshot: Record<string, unknown>;

  /** SHA-256 of the canonical snapshot, for change detection. */
  @Prop({ type: String, required: true })
  contentHash: string;

  @Prop({
    type: {
      cycles: { type: Number, default: 0 },
      dailyLogs: { type: Number, default: 0 },
      pregnancies: { type: Number, default: 0 },
    },
    default: {},
  })
  recordCounts: { cycles?: number; dailyLogs?: number; pregnancies?: number };

  @Prop({ type: String, required: true })
  generatorVersion: string;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date })
  revokedAt?: Date;
}

export const HealthBriefSchema = SchemaFactory.createForClass(HealthBrief);
HealthBriefSchema.index({ ownerUserId: 1, createdAt: -1 }, { name: 'idx_brief_owner_created' });
HealthBriefSchema.index({ recipientUserId: 1, expiresAt: 1 }, { name: 'idx_brief_recipient_expiry' });
