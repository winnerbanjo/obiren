import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SafetyPinDocument = SafetyPin & Document;

/**
 * Safety PIN - stored ONLY as an argon2id hash. Never returned by any API.
 * A separate collection keeps the PIN isolated from normal user reads.
 */
@Schema({ timestamps: true, collection: 'safety_pins' })
export class SafetyPin {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  pinHash: string;

  @Prop({ type: Number, default: 0 })
  failedAttempts: number;

  @Prop({ type: Date })
  lockedUntil?: Date;
}

export const SafetyPinSchema = SchemaFactory.createForClass(SafetyPin);
SafetyPinSchema.index({ userId: 1 }, { unique: true, name: 'uniq_safety_pin_userId' });
