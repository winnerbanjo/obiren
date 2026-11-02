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
  @Prop({ type: String, maxlength: 60 }) professionalTitle?: string;
  @Prop({ type: String, maxlength: 40 }) licenceNumber?: string;
  @Prop({ type: Number, min: 0, max: 70 }) yearsOfExperience?: number;
  @Prop({ type: String, maxlength: 160 }) clinicName?: string;
  @Prop({ type: String, maxlength: 300 }) clinicAddress?: string;
  @Prop({ type: String, maxlength: 40 }) phoneNumber?: string;
  @Prop({ type: String, maxlength: 500 }) photoUrl?: string;
  @Prop({ type: String, maxlength: 80 }) timeZone?: string;
  @Prop({ type: Number, min: 10, max: 240, default: 45 }) consultationDurationMinutes: number;
  @Prop({ type: Number, min: 0, max: 120, default: 0 }) bufferMinutes: number;
  /** instant = paid booking is confirmed automatically; manual = doctor confirms. */
  @Prop({ required: true, enum: ['instant', 'manual'], default: 'instant' }) bookingApprovalMode: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdByUserId?: Types.ObjectId;
  @Prop({ type: String, maxlength: 500 }) suspensionReason?: string;
  @Prop({ type: String, maxlength: 500 }) adminNote?: string;
  @Prop({ type: Boolean, default: false }) credentialReviewRequired: boolean;
  @Prop({ type: String, maxlength: 2000 }) bio?: string;
  @Prop({ type: [String], default: [] }) certifications: string[];
  // Session prices in the minor unit of the country currency (e.g. kobo).
  // Absent means no approved price exists and checkout must fail closed.
  @Prop({
    // Prices are a plain map, not a subdocument: without `_id: false` Mongoose
    // injects an `_id` key that then renders as a phantom "_id" session fee and
    // can be copied back by the admin fee editor.
    _id: false,
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
// Sparse so existing profiles and doctors without a recorded licence stay valid.
ClinicianSchema.index({ licenceNumber: 1 }, { unique: true, sparse: true, name: 'uniq_clinician_licence' });

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
    enum: [
      'held',
      'pending_payment',
      'pending',
      'confirmed',
      'reschedule_requested',
      'rejected',
      'cancelled',
      'completed',
      'no_show',
      'expired',
    ],
    default: 'held',
    index: true,
  })
  status: string;
  /** Patient-supplied reason for the appointment. Never a clinical record. */
  @Prop({ type: String, maxlength: 1000 }) patientNote?: string;
  /** Immutable, append-only lifecycle trail used by the Doctor Portal and Admin. */
  @Prop({
    type: [
      {
        from: { type: String, default: null },
        to: { type: String, required: true },
        actorUserId: { type: Types.ObjectId, ref: 'User' },
        actorRole: { type: String, required: true },
        reason: { type: String, maxlength: 500 },
        at: { type: Date, required: true },
      },
    ],
    default: [],
  })
  statusHistory: Array<{ from?: string | null; to: string; actorUserId?: Types.ObjectId; actorRole: string; reason?: string; at: Date }>;
  @Prop({ required: true, min: 0 }) amountMinor: number;
  @Prop({ required: true, uppercase: true, minlength: 3, maxlength: 3 }) currency: string;
  @Prop({ type: String }) pricePolicyVersion?: string;
  @Prop({ type: String }) reference?: string;
  @Prop({ type: Types.ObjectId, ref: 'Payment' }) paymentId?: Types.ObjectId;
  @Prop({ type: Date }) expiresAt?: Date;
  @Prop({ type: Date }) confirmedAt?: Date;
  @Prop({ type: Date }) completedAt?: Date;
  @Prop({ type: Date }) cancelledAt?: Date;
  @Prop({ type: Date }) rejectedAt?: Date;
  @Prop({ type: Date }) noShowAt?: Date;
  @Prop({ type: Date }) rescheduledAt?: Date;
  @Prop({ type: String, maxlength: 300 }) cancellationReason?: string;
  @Prop({ type: String, maxlength: 500 }) rejectionReason?: string;
  @Prop({
    type: [
      {
        slotId: { type: Types.ObjectId, ref: 'AvailabilitySlot' },
        startsAt: Date,
        endsAt: Date,
        at: Date,
      },
    ],
    default: [],
  })
  rescheduledFrom: Array<{ slotId?: Types.ObjectId; startsAt: Date; endsAt: Date; at: Date }>;
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

/**
 * A promotion managed by staff. Validation is read-only: a discount is quoted
 * from this record plus the server price, but nothing is redeemed until the
 * approved checkout path applies it.
 */
export type PromoCodeDocument = PromoCode & Document;
@Schema({ timestamps: true, collection: 'promo_codes' })
export class PromoCode {
  @Prop({ required: true, unique: true, uppercase: true, trim: true, maxlength: 40 }) code: string;
  @Prop({ required: true, min: 1, max: 100 }) percentOff: number;
  @Prop({ required: true, maxlength: 40 }) policyVersion: string;
  @Prop({ type: Number, min: 1 }) maxRedemptions?: number;
  @Prop({ type: Number, default: 0, min: 0 }) redemptions: number;
  @Prop({ type: Date }) expiresAt?: Date;
  @Prop({ type: Boolean, default: true }) active: boolean;
  @Prop({ type: Types.ObjectId, ref: 'User', required: true }) createdByUserId: Types.ObjectId;
}
export const PromoCodeSchema = SchemaFactory.createForClass(PromoCode);
PromoCodeSchema.index({ active: 1, expiresAt: 1 }, { name: 'idx_promo_active_expiry' });

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

/**
 * A doctor's recurring weekly availability. Concrete bookable slots are
 * materialised from these rules by AvailabilityService, so the user app and
 * the Doctor Portal always share one server-side calculation.
 *
 * Times are minutes from local midnight (0-1439) in the doctor's own timezone.
 * `dayOfWeek` is 0 = Sunday .. 6 = Saturday, matching JavaScript's getDay().
 */
export type DoctorAvailabilityRuleDocument = DoctorAvailabilityRule & Document;
@Schema({ timestamps: true, collection: 'doctor_availability_rules' })
export class DoctorAvailabilityRule {
  @Prop({ type: Types.ObjectId, ref: 'Clinician', required: true, index: true }) clinicianId: Types.ObjectId;
  @Prop({ required: true, min: 0, max: 6 }) dayOfWeek: number;
  @Prop({ required: true, min: 0, max: 1439 }) startMinutes: number;
  @Prop({ required: true, min: 1, max: 1440 }) endMinutes: number;
  @Prop({ required: true, enum: ['clinic', 'audio', 'video', 'text'], default: 'video' }) sessionType: string;
  @Prop({ type: Boolean, default: true }) active: boolean;
}
export const DoctorAvailabilityRuleSchema = SchemaFactory.createForClass(DoctorAvailabilityRule);
DoctorAvailabilityRuleSchema.index({ clinicianId: 1, dayOfWeek: 1, startMinutes: 1 }, { name: 'idx_rule_doctor_day' });

/** Blocked dates and leave. Overlapping confirmed bookings are reported, never removed. */
export type DoctorTimeOffDocument = DoctorTimeOff & Document;
@Schema({ timestamps: true, collection: 'doctor_time_off' })
export class DoctorTimeOff {
  @Prop({ type: Types.ObjectId, ref: 'Clinician', required: true, index: true }) clinicianId: Types.ObjectId;
  @Prop({ required: true }) startsAt: Date;
  @Prop({ required: true }) endsAt: Date;
  @Prop({ type: String, maxlength: 300 }) reason?: string;
  @Prop({ type: Types.ObjectId, ref: 'User' }) createdByUserId?: Types.ObjectId;
}
export const DoctorTimeOffSchema = SchemaFactory.createForClass(DoctorTimeOff);
DoctorTimeOffSchema.index({ clinicianId: 1, startsAt: 1 }, { name: 'idx_time_off_doctor_start' });
