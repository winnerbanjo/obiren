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

  @Prop({ type: String, enum: ['not_requested', 'queued', 'partial', 'sent', 'failed', 'simulated'], default: 'not_requested' })
  dispatchStatus: string;

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

  @Prop({ type: String, maxlength: 160 })
  locationSessionId?: string;

  @Prop({ type: Date })
  locationExpiresAt?: Date;

  @Prop({ type: [String], default: [] })
  dispatchedNotificationIds: string[];
}

export const SafetyIncidentSchema = SchemaFactory.createForClass(SafetyIncident);
SafetyIncidentSchema.index({ userId: 1, createdAt: -1 });
SafetyIncidentSchema.index({ status: 1, createdAt: -1 });

export type SafetyDeliveryAttemptDocument = SafetyDeliveryAttempt & Document;
/**
 * Per-recipient SOS delivery record. An attempt is only marked sent when an
 * approved provider returns evidence; otherwise it stays skipped or failed.
 */
@Schema({ timestamps: true, collection: 'safety_delivery_attempts' })
export class SafetyDeliveryAttempt {
  @Prop({ type: Types.ObjectId, ref: 'SafetyIncident', required: true, index: true }) incidentId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) ownerUserId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'GuardianContact' }) guardianContactId?: Types.ObjectId;
  @Prop({ type: String, enum: ['guardian_alert', 'emergency_services'], required: true }) channel: string;
  @Prop({ type: String, enum: ['skipped', 'simulated', 'sent', 'failed'], default: 'skipped' }) status: string;
  @Prop({ type: String, maxlength: 80 }) failureCode?: string;
  @Prop({ type: String }) providerMessageId?: string;
  @Prop({ type: Date, default: Date.now }) attemptedAt: Date;
}
export const SafetyDeliveryAttemptSchema = SchemaFactory.createForClass(SafetyDeliveryAttempt);
SafetyDeliveryAttemptSchema.index({ incidentId: 1, createdAt: 1 }, { name: 'idx_delivery_attempt_incident' });
SafetyDeliveryAttemptSchema.index({ ownerUserId: 1, createdAt: -1 }, { name: 'idx_delivery_attempt_owner' });

export type GuardianContactDocument = GuardianContact & Document;
@Schema({ timestamps: true, collection: 'guardian_contacts' })
export class GuardianContact {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) ownerUserId: Types.ObjectId;
  @Prop({ type: String, required: true, trim: true, maxlength: 120 }) name: string;
  @Prop({ type: String, required: true, trim: true, maxlength: 20 }) phoneE164: string;
  @Prop({ type: String, enum: ['pending', 'verified', 'revoked'], default: 'pending' }) status: string;
  @Prop({ type: [String], default: ['sos_alert'] }) scopes: string[];
  @Prop({ type: Date }) acceptedAt?: Date;
  @Prop({ type: Date }) verifiedAt?: Date;
  @Prop({ type: Date }) revokedAt?: Date;
  /** Last time the owner re-issued this invitation; used for resend throttling. */
  @Prop({ type: Date }) lastInviteResentAt?: Date;
}
export const GuardianContactSchema = SchemaFactory.createForClass(GuardianContact);
GuardianContactSchema.index({ ownerUserId: 1, status: 1 });
GuardianContactSchema.index({ ownerUserId: 1, phoneE164: 1 }, { unique: true });

export type LocationSessionDocument = LocationSession & Document;
@Schema({ timestamps: true, collection: 'location_sessions' })
export class LocationSession {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) ownerUserId: Types.ObjectId;
  @Prop({ type: Date, required: true, default: Date.now }) startedAt: Date;
  @Prop({ type: Date, required: true }) expiresAt: Date;
  @Prop({ type: String, enum: ['active', 'revoked'], default: 'active' }) status: string;
  @Prop({ type: Number, min: -90, max: 90 }) latitude?: number;
  @Prop({ type: Number, min: -180, max: 180 }) longitude?: number;
  @Prop({ type: Date }) locationRecordedAt?: Date;
}
export const LocationSessionSchema = SchemaFactory.createForClass(LocationSession);
LocationSessionSchema.index({ ownerUserId: 1, status: 1, expiresAt: 1 });
LocationSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'ttl_location_session_expiry' });

export type GuardianInviteDocument = GuardianInvite & Document;
@Schema({ timestamps: true, collection: 'guardian_invites' })
export class GuardianInvite {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) ownerUserId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'GuardianContact', required: true }) contactId: Types.ObjectId;
  @Prop({ type: String, required: true, select: false }) tokenHash: string;
  @Prop({ type: Date, required: true }) expiresAt: Date;
  @Prop({ type: Date }) acceptedAt?: Date;
  @Prop({ type: Date }) revokedAt?: Date;
  @Prop({ type: String, enum: ['pending', 'accepted', 'expired', 'revoked'], default: 'pending' }) status: string;
}
export const GuardianInviteSchema = SchemaFactory.createForClass(GuardianInvite);
GuardianInviteSchema.index({ ownerUserId: 1, status: 1 });
GuardianInviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'ttl_guardian_invite_retention' });
