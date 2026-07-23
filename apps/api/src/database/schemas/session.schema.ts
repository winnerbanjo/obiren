import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SessionDocument = Session & Document;

@Schema({ timestamps: true, collection: 'sessions' })
export class Session {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true, unique: true })
  refreshTokenHash: string;

  @Prop({ type: String })
  deviceId: string;

  @Prop({ type: String })
  deviceName: string;

  @Prop({ type: String, enum: ['web', 'ios', 'android'], default: 'web' })
  platform: string;

  @Prop({ type: String })
  ipAddressHash: string;

  @Prop({ type: String })
  userAgent: string;

  @Prop({ type: Date, default: Date.now })
  lastUsedAt: Date;

  @Prop({ type: Date, required: true })
  expiresAt: Date;

  @Prop({ type: Date })
  revokedAt?: Date;

  @Prop({ type: String })
  revokeReason?: string;
}

export const SessionSchema = SchemaFactory.createForClass(Session);
SessionSchema.index({ refreshTokenHash: 1 }, { unique: true });
SessionSchema.index({ userId: 1, revokedAt: 1 });
// PRD Audit 2: Explicit TTL Index configuration (expiresAfterSeconds: 0)
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_session_expiresAt' });
