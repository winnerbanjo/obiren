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
  @Prop({ type: String, maxlength: 120 }) profession?: string;
  @Prop({ type: String, maxlength: 2000 }) bio?: string;
  @Prop({ type: [String], default: [] }) certifications: string[];
  // Session prices in the minor unit of the country currency (e.g. kobo).
  // Absent means no approved price exists and checkout must fail closed.
  @Prop({
    type: {
      clinic: { type: Number, min: 0 },
      audio: { type: Number, min: 0 },
      video: { type: Number, min: 0 },
      text: { type: Number, min: 0 },
    },
  })
  feeBySessionType?: { clinic?: number; audio?: number; video?: number; text?: number };
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

/**
 * A booking only exists after a slot hold succeeds. Confirmation happens
 * exclusively through a verified Paystack webhook; nothing else may set
 * `status: 'confirmed'`.
 */
export type BookingDocument = Booking & Document;
@Schema({ timestamps: true, collection: 'bookings' })
export class Booking {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Clinician', required: true, index: true }) clinicianId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'AvailabilitySlot', required: true }) slotId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'BookingHold', required: true }) holdId: Types.ObjectId;
  @Prop({ required: true, enum: ['clinic', 'audio', 'video', 'text'] }) sessionType: string;
  @Prop({ required: true }) startsAt: Date;
  @Prop({ required: true }) endsAt: Date;
  @Prop({ type: String }) timeZone: string;
  @Prop({
    required: true,
    enum: ['held', 'pending_payment', 'confirmed', 'cancelled', 'completed', 'expired'],
    default: 'held',
    index: true,
  })
  status: string;
  @Prop({ required: true, min: 0 }) amountMinor: number;
  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 }) currency: string;
  @Prop({ type: String }) pricePolicyVersion?: string;
  @Prop({ type: String }) reference?: string;
  @Prop({ type: Types.ObjectId, ref: 'Payment' }) paymentId?: Types.ObjectId;
  @Prop({ type: Date }) expiresAt?: Date;
  @Prop({ type: Date }) confirmedAt?: Date;
  @Prop({ type: Date }) cancelledAt?: Date;
  @Prop({ type: String, maxlength: 300 }) cancellationReason?: string;
  @Prop({ type: String, enum: ['none', 'not_required', 'pending_policy', 'refunded'], default: 'none' }) refundStatus: string;
  @Prop({ type: Number, default: 1 }) version: number;
}
export const BookingSchema = SchemaFactory.createForClass(Booking);
// One booking per temporary hold: the atomic slot update already guarantees a
// single winner, and this index prevents duplicate bookings for that hold.
BookingSchema.index({ holdId: 1 }, { unique: true, name: 'uniq_booking_hold' });
BookingSchema.index({ reference: 1 }, { unique: true, sparse: true, name: 'uniq_booking_reference' });
BookingSchema.index({ userId: 1, createdAt: -1 }, { name: 'idx_booking_user_created' });
BookingSchema.index({ clinicianId: 1, startsAt: -1 }, { name: 'idx_booking_clinician_start' });
BookingSchema.index({ status: 1, expiresAt: 1 }, { name: 'idx_booking_status_expiry' });

export type PaymentDocument = Payment & Document;
@Schema({ timestamps: true, collection: 'payments' })
export class Payment {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true, index: true }) userId: Types.ObjectId;
  @Prop({ type: Types.ObjectId, ref: 'Booking', required: true, index: true }) bookingId: Types.ObjectId;
  @Prop({ required: true, enum: ['paystack'] }) gateway: string;
  @Prop({ required: true, unique: true }) reference: string;
  @Prop({ required: true, min: 0 }) amountMinor: number;
  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 }) currency: string;
  @Prop({ required: true, enum: ['initialized', 'succeeded', 'failed', 'abandoned'], default: 'initialized' }) status: string;
  @Prop({ type: String }) authorizationUrl?: string;
  @Prop({ type: String }) accessCode?: string;
  @Prop({ type: String }) gatewayTransactionId?: string;
  @Prop({ type: Number }) verifiedAmountMinor?: number;
  @Prop({ type: String }) verifiedCurrency?: string;
  @Prop({ type: Date }) verifiedAt?: Date;
  @Prop({ type: String, maxlength: 300 }) failureReason?: string;
}
export const PaymentSchema = SchemaFactory.createForClass(Payment);
PaymentSchema.index({ bookingId: 1, createdAt: -1 }, { name: 'idx_payment_booking_created' });
PaymentSchema.index({ gateway: 1, status: 1 }, { name: 'idx_payment_gateway_status' });

/** Webhook replay protection: every provider event id is stored once. */
export type PaymentWebhookEventDocument = PaymentWebhookEvent & Document;
@Schema({ timestamps: true, collection: 'payment_webhook_events' })
export class PaymentWebhookEvent {
  @Prop({ required: true, unique: true }) eventId: string;
  @Prop({ required: true }) event: string;
  @Prop({ type: String }) reference?: string;
  @Prop({ required: true }) payloadHash: string;
  @Prop({ type: String, maxlength: 80 }) outcome: string;
  @Prop({ type: Date }) receivedAt: Date;
}
export const PaymentWebhookEventSchema = SchemaFactory.createForClass(PaymentWebhookEvent);
PaymentWebhookEventSchema.index({ reference: 1, createdAt: -1 }, { name: 'idx_payment_event_reference' });
