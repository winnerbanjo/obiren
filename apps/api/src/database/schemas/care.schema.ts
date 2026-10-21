import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClinicianDocument = Clinician & Document;
@Schema({ timestamps: true, collection: 'clinicians' })
export class Clinician {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, unique: true, index: true }) userId: Types.ObjectId;
  @Prop({ required: true, trim: true, maxlength: 120 }) displayName: string;
  @Prop({ type: [String], default: [] }) specialties: string[];
  @Prop({ type: [String], default: [] }) languages: string[];
  @Prop({ required: true, enum: ['NG', 'GH', 'GB', 'US'] }) countryCode: string;
  @Prop({ required: true, enum: ['pending', 'verified', 'rejected'], default: 'pending' }) verificationStatus: string;
  @Prop({ type: String, maxlength: 300 }) verificationEvidenceRef?: string;
  @Prop({ type: String, maxlength: 500 }) verificationNote?: string;
  @Prop({ type: Date }) reviewedAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'User' }) reviewedBy?: Types.ObjectId;
  @Prop({ type: Boolean, default: false }) active: boolean;
}
export const ClinicianSchema = SchemaFactory.createForClass(Clinician);
ClinicianSchema.index({ verificationStatus: 1, active: 1, countryCode: 1 });

export type AvailabilitySlotDocument = AvailabilitySlot & Document;
@Schema({ timestamps: true, collection: 'availability_slots' })
export class AvailabilitySlot {
  @Prop({ type: Types.ObjectId, ref: 'Clinician', required: true, index: true }) clinicianId: Types.ObjectId;
  @Prop({ required: true }) startsAt: Date;
  @Prop({ required: true }) endsAt: Date;
  @Prop({ required: true, enum: ['clinic', 'audio', 'video', 'text'] }) sessionType: string;
  @Prop({ required: true, enum: ['open', 'held', 'booked', 'cancelled'], default: 'open' }) status: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) heldBy?: Types.ObjectId;
  @Prop({ type: Date }) holdExpiresAt?: Date;
  @Prop({ type: Types.ObjectId, ref: 'BookingHold' }) holdId?: Types.ObjectId;
}
export const AvailabilitySlotSchema = SchemaFactory.createForClass(AvailabilitySlot);
AvailabilitySlotSchema.index({ clinicianId: 1, startsAt: 1 }, { unique: true, name: 'uniq_clinician_slot_start' });
AvailabilitySlotSchema.index({ status: 1, startsAt: 1, holdExpiresAt: 1 });

export type BookingHoldDocument = BookingHold & Document;
@Schema({ timestamps: true, collection: 'booking_holds' })
export class BookingHold {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Clinician', required: true }) clinicianId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'AvailabilitySlot', required: true, index: true }) slotId: Types.ObjectId;
  @Prop({ required: true, enum: ['held', 'expired', 'cancelled'], default: 'held' }) status: string;
  @Prop({ required: true }) expiresAt: Date;
}
export const BookingHoldSchema = SchemaFactory.createForClass(BookingHold);
BookingHoldSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60, name: 'ttl_booking_hold_retention' });
BookingHoldSchema.index({ userId: 1, createdAt: -1 });
BookingHoldSchema.index({ slotId: 1, status: 1 });
