import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Staff-recorded verification state for one published emergency-directory
 * record. The published dataset is the source of the phone numbers; this
 * collection is the honest freshness record: when a human last checked the
 * resource, how they checked it, and when it must be checked again.
 *
 * A missing review means "never reviewed" — it never implies verification.
 */
export type EmergencyResourceReviewDocument = EmergencyResourceReview & Document;

@Schema({ timestamps: true, collection: 'emergency_resource_reviews' })
export class EmergencyResourceReview {
  /** Public dataset identifier, e.g. `NG-001`. */
  @Prop({ type: String, required: true, unique: true, index: true })
  recordId: string;

  @Prop({
    type: String,
    required: true,
    enum: ['source_verified', 'directory_source_verified', 'operationally_confirmed', 'unverified'],
  })
  verificationStatus: string;

  /** When a staff member last checked this resource. Always set by the server. */
  @Prop({ type: Date, required: true })
  lastCheckedAt: Date;

  /** When this resource must be re-checked. Defaults to last checked + review interval. */
  @Prop({ type: Date, required: true })
  nextReviewDueAt: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  checkedByUserId: Types.ObjectId;

  /** Reference to stored evidence, e.g. a call log id or a source snapshot. */
  @Prop({ type: String, maxlength: 300 })
  evidenceRef?: string;

  @Prop({ type: String, maxlength: 500 })
  note?: string;
}

export const EmergencyResourceReviewSchema = SchemaFactory.createForClass(EmergencyResourceReview);

// Support "which resources are overdue" operational queries.
EmergencyResourceReviewSchema.index({ nextReviewDueAt: 1 }, { name: 'idx_emergency_review_due' });
EmergencyResourceReviewSchema.index({ verificationStatus: 1, nextReviewDueAt: 1 }, { name: 'idx_emergency_review_status_due' });
