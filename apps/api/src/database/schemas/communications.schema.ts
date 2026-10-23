import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type NotificationPreferenceDocument = NotificationPreference & Document;
@Schema({ timestamps: true, collection: 'notification_preferences' })
export class NotificationPreference {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) userId: Types.ObjectId;
  @Prop({ type: Boolean, default: true }) inAppEnabled: boolean;
  @Prop({ type: Boolean, default: false }) emailEnabled: boolean;
  @Prop({ type: Boolean, default: false }) smsEnabled: boolean;
  @Prop({ type: Boolean, default: true }) discreetMode: boolean;
  @Prop({ type: [String], default: [] }) disabledCategories: string[];
}
export const NotificationPreferenceSchema = SchemaFactory.createForClass(NotificationPreference);
NotificationPreferenceSchema.index({ userId: 1 }, { unique: true });

export type ConsultationDocument = Consultation & Document;
/**
 * A care relationship between one patient and one verified clinician.
 * Created by an administrator after an approved care pathway; it is not a
 * confirmed booking, payment, or clinical appointment.
 */
@Schema({ timestamps: true, collection: 'consultations' })
export class Consultation {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) patientUserId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) clinicianUserId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Clinician' }) clinicianId?: Types.ObjectId;
  @Prop({ type: [Types.ObjectId], ref: 'User', required: true }) participantUserIds: Types.ObjectId[];
  @Prop({ type: String, enum: ['open', 'closed'], default: 'open' }) status: string;
  @Prop({ type: Date }) closedAt?: Date;
  @Prop({ type: Date, default: Date.now }) lastMessageAt: Date;
}
export const ConsultationSchema = SchemaFactory.createForClass(Consultation);
ConsultationSchema.index({ participantUserIds: 1, _id: -1 }, { name: 'idx_consultation_participant' });
ConsultationSchema.index({ patientUserId: 1, createdAt: -1 }, { name: 'idx_consultation_patient' });
ConsultationSchema.index({ clinicianUserId: 1, createdAt: -1 }, { name: 'idx_consultation_clinician' });

export type MessageDocument = Message & Document;
@Schema({ timestamps: true, collection: 'consultation_messages' })
export class Message {
  @Prop({ type: Types.ObjectId, ref: 'Consultation', required: true, index: true }) consultationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) senderUserId: Types.ObjectId;
  @Prop({ type: String, required: true }) ciphertext: string;
  @Prop({ type: String, required: true }) iv: string;
  @Prop({ type: String, required: true }) authTag: string;
  @Prop({ type: String, required: true }) keyId: string;
  @Prop({ type: String, enum: ['sent', 'delivered', 'read'], default: 'sent' }) status: string;
  @Prop({ type: Date }) deliveredAt?: Date;
  @Prop({ type: Date }) readAt?: Date;
}
export const MessageSchema = SchemaFactory.createForClass(Message);
MessageSchema.index({ consultationId: 1, createdAt: -1 });

export type HealthShareDocument = HealthShare & Document;
@Schema({ timestamps: true, collection: 'health_shares' })
export class HealthShare {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) ownerUserId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) recipientUserId: Types.ObjectId;
  @Prop({ type: [String], required: true }) scopes: string[];
  @Prop({ type: String, required: true }) evidenceFrom: string;
  @Prop({ type: String, required: true }) evidenceTo: string;
  @Prop({ type: Object, required: true }) redactedSnapshot: Record<string, unknown>;
  @Prop({ type: Date, required: true }) expiresAt: Date;
  @Prop({ type: Date }) revokedAt?: Date;
  @Prop({ type: Date, required: true }) consentedAt: Date;
}
export const HealthShareSchema = SchemaFactory.createForClass(HealthShare);
HealthShareSchema.index({ ownerUserId: 1, createdAt: -1 });
HealthShareSchema.index({ recipientUserId: 1, expiresAt: 1, revokedAt: 1 });

/**
 * Message attachment metadata. Files live in the storage provider; nothing is
 * downloadable until malware scanning is configured, so `available` stays false
 * and the scan state is reported honestly.
 */
export type AttachmentDocument = Attachment & Document;
@Schema({ timestamps: true, collection: 'consultation_attachments' })
export class Attachment {
  @Prop({ type: Types.ObjectId, ref: 'Consultation', required: true, index: true }) consultationId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) uploaderUserId: Types.ObjectId;
  @Prop({ type: String, required: true, maxlength: 200 }) fileName: string;
  @Prop({ type: String, required: true, enum: ['image/jpeg', 'image/png', 'application/pdf'] }) contentType: string;
  @Prop({ type: Number, required: true, min: 1, max: 10485760 }) sizeBytes: number;
  @Prop({ type: String, required: true, maxlength: 300 }) storagePublicId: string;
  @Prop({ type: String, required: true, enum: ['not_configured', 'pending', 'clean', 'infected'], default: 'not_configured' }) scanStatus: string;
  @Prop({ type: Boolean, default: false }) available: boolean;
}
export const AttachmentSchema = SchemaFactory.createForClass(Attachment);
AttachmentSchema.index({ consultationId: 1, createdAt: -1 }, { name: 'idx_attachment_consultation_created' });

export type DeviceDocument = Device & Document;
/**
 * A registered mobile/web notification target. Only a salted hash of the
 * provider token is stored, and the token is never returned by the API.
 */
@Schema({ timestamps: true, collection: 'devices' })
export class Device {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: String, enum: ['ios', 'android', 'web'], required: true }) platform: string;
  @Prop({ type: String, required: true, select: false }) tokenHash: string;
  @Prop({ type: String, maxlength: 80 }) deviceName?: string;
  @Prop({ type: String, enum: ['active', 'revoked'], default: 'active' }) status: string;
  @Prop({ type: Date, default: Date.now }) lastSeenAt: Date;
  @Prop({ type: Date }) revokedAt?: Date;
}
export const DeviceSchema = SchemaFactory.createForClass(Device);
DeviceSchema.index({ tokenHash: 1 }, { unique: true, name: 'uniq_device_token_hash' });
DeviceSchema.index({ userId: 1, status: 1, lastSeenAt: -1 }, { name: 'idx_device_owner_status' });
