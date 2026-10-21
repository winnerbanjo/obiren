import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * A TOTP credential for one account. The shared secret is encrypted at rest
 * with the configured encryption key and is never returned after enrollment;
 * recovery codes are stored only as SHA-256 hashes.
 */
export type MfaCredentialDocument = MfaCredential & Document;

@Schema({ timestamps: true, collection: 'mfa_credentials' })
export class MfaCredential {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true })
  userId: Types.ObjectId;

  @Prop({ type: String, required: true }) secretCiphertext: string;
  @Prop({ type: String, required: true }) secretIv: string;
  @Prop({ type: String, required: true }) secretAuthTag: string;
  @Prop({ type: String, required: true }) keyId: string;

  /** `pending` until the first valid code proves the authenticator is set up. */
  @Prop({ type: String, required: true, enum: ['pending', 'enabled'], default: 'pending' })
  status: string;

  @Prop({ type: [String], default: [] })
  recoveryCodeHashes: string[];

  @Prop({ type: Date }) enabledAt?: Date;
  @Prop({ type: Date }) lastUsedAt?: Date;
}

export const MfaCredentialSchema = SchemaFactory.createForClass(MfaCredential);
