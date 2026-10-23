import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type IdempotencyRecordDocument = IdempotencyRecord & Document;

/**
 * Persisted idempotency key scoped to the authenticated account and route.
 * `response` stores the service-level payload; the HTTP layer re-applies the
 * response envelope on replay so the fresh requestId is always echoed.
 */
@Schema({ timestamps: true, collection: 'idempotency_records' })
export class IdempotencyRecord {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true, maxlength: 120 })
  key: string;

  @Prop({ type: String, required: true, maxlength: 160 })
  route: string;

  @Prop({ type: String, required: true })
  requestHash: string;

  @Prop({ type: String, enum: ['processing', 'completed'], default: 'processing' })
  status: string;

  @Prop({ type: Number })
  responseStatus?: number;

  @Prop({ type: Object })
  response?: Record<string, unknown>;

  @Prop({ type: Date, required: true })
  expiresAt: Date;
}

export const IdempotencyRecordSchema = SchemaFactory.createForClass(IdempotencyRecord);
IdempotencyRecordSchema.index(
  { userId: 1, route: 1, key: 1 },
  { unique: true, name: 'uniq_idempotency_user_route_key' },
);
IdempotencyRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_idempotency_expiry' });
