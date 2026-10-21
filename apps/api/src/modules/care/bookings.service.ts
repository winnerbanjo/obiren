import {
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { env } from '../../config/env.validation';
import {
  AvailabilitySlot,
  AvailabilitySlotDocument,
  Booking,
  BookingDocument,
  BookingHold,
  BookingHoldDocument,
  Payment,
  PaymentDocument,
  PaymentWebhookEvent,
  PaymentWebhookEventDocument,
} from '../../database/schemas/care.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { CareService } from './care.service';
import { PaystackProvider } from '../../common/payments/paystack.provider';

const PAYMENT_REUSE_MINUTES = 30;

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

  constructor(
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(PaymentWebhookEvent.name) private readonly eventModel: Model<PaymentWebhookEventDocument>,
    @InjectModel(AvailabilitySlot.name) private readonly slotModel: Model<AvailabilitySlotDocument>,
    @InjectModel(BookingHold.name) private readonly holdModel: Model<BookingHoldDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly careService: CareService,
    private readonly paystack: PaystackProvider,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  private presentBooking(booking: BookingDocument | (Booking & { _id: Types.ObjectId })) {
    return {
      id: booking._id.toString(),
      status: booking.status,
      sessionType: booking.sessionType,
      clinicianId: booking.clinicianId.toString(),
      slotId: booking.slotId.toString(),
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      timeZone: booking.timeZone,
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      reference: booking.reference ?? null,
      expiresAt: booking.expiresAt ? booking.expiresAt.toISOString() : null,
      confirmedAt: booking.confirmedAt ? booking.confirmedAt.toISOString() : null,
      cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
      refundStatus: booking.refundStatus,
      cancellationReason: booking.cancellationReason ?? null,
    };
  }

  private presentPayment(payment: PaymentDocument | (Payment & { _id: Types.ObjectId })) {
    return {
      id: payment._id.toString(),
      bookingId: payment.bookingId.toString(),
      gateway: payment.gateway,
      reference: payment.reference,
      status: payment.status,
      amountMinor: payment.amountMinor,
      currency: payment.currency,
      authorizationUrl: payment.authorizationUrl ?? null,
      accessCode: payment.accessCode ?? null,
      verifiedAt: payment.verifiedAt ? payment.verifiedAt.toISOString() : null,
      failureReason: payment.failureReason ?? null,
    };
  }

  private async timeZoneFor(userId: string): Promise<string> {
    const profile = await this.bookingModel.db
      .collection('user_profiles')
      .findOne({ userId: new Types.ObjectId(userId) }, { projection: { timeZone: 1 } });
    return profile?.timeZone || 'Africa/Lagos';
  }

  /**
   * PRD `POST /bookings/hold`. A hold is reserved atomically on the slot, then
   * priced server-side and persisted as a `held` booking. A hold is not a
   * booking confirmation and never takes payment.
   */
  async createHold(userId: string, slotId: string) {
    const slot = await this.slotModel.findOne({ _id: new Types.ObjectId(slotId) }).lean().exec();
    if (!slot) throw new NotFoundException('Availability slot not found');

    // Price before reserving inventory so an unpriced session cannot occupy a slot.
    const price = await this.careService.priceFor(slot.clinicianId, slot.sessionType);
    const held = await this.careService.holdSlot(userId, slotId);

    try {
      const booking = await this.bookingModel.create({
        userId: new Types.ObjectId(userId),
        clinicianId: slot.clinicianId,
        slotId: slot._id,
        holdId: new Types.ObjectId(held.data.holdId as string),
        sessionType: slot.sessionType,
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        timeZone: await this.timeZoneFor(userId),
        status: 'held',
        amountMinor: price.amountMinor,
        currency: price.currency,
        pricePolicyVersion: env().paymentPolicyVersion,
        expiresAt: new Date(held.data.expiresAt),
      });

      return {
        success: true,
        data: {
          booking: this.presentBooking(booking),
          holdExpiresAt: booking.expiresAt,
          checkoutEnabled: this.paystack.isEnabled(),
          message: 'Temporary hold only. No appointment or payment is confirmed until the provider verifies payment.',
        },
        meta: this.meta(),
      };
    } catch (error) {
      // Never leave an orphaned slot hold when the booking cannot be persisted.
      await this.careService.cancelHold(userId, held.data.holdId as string).catch(() => undefined);
      throw error;
    }
  }

  /**
   * PRD `POST /bookings/:id/payment-intent`. Amount and currency are fetched
   * from the clinician profile again, so a stale client price can never be
   * charged. Disabled checkout returns 503 and writes no payment.
   */
  async createPaymentIntent(userId: string, bookingId: string) {
    if (!this.paystack.isEnabled()) {
      throw new ServiceUnavailableException(
        'Checkout is disabled until payment credentials and an approved pricing/refund policy are configured. No payment was attempted.',
      );
    }

    const booking = await this.bookingModel.findOne({ _id: new Types.ObjectId(bookingId), userId: new Types.ObjectId(userId) });
    if (!booking) throw new NotFoundException('Booking not found');

    if (booking.status === 'confirmed') throw new ConflictException('This booking is already confirmed and paid');
    if (booking.status !== 'held' && booking.status !== 'pending_payment') {
      throw new ConflictException(`A payment cannot be started for a ${booking.status} booking`);
    }
    if (booking.status === 'held' && booking.expiresAt && booking.expiresAt.getTime() <= Date.now()) {
      booking.status = 'expired';
      await booking.save();
      throw new ConflictException('The temporary hold has expired. Start a new hold.');
    }

    const price = await this.careService.priceFor(booking.clinicianId, booking.sessionType);
    if (price.amountMinor !== booking.amountMinor || price.currency !== booking.currency) {
      throw new ConflictException({
        success: false,
        error: {
          code: 'PRICE_CHANGED',
          message: 'The price for this session changed after the hold was created. Start a new hold to see the current price.',
        },
      });
    }

    const reusable = await this.paymentModel.findOne({
      bookingId: booking._id,
      status: 'initialized',
      authorizationUrl: { $exists: true },
      createdAt: { $gte: new Date(Date.now() - PAYMENT_REUSE_MINUTES * 60_000) },
    });
    if (reusable) {
      return { success: true, data: { payment: this.presentPayment(reusable), reused: true }, meta: this.meta() };
    }

    const user = await this.userModel.findById(userId).select('email').lean().exec();
    if (!user?.email) throw new NotFoundException('Account email is required before checkout');

    const reference = `obiren-${booking._id.toString()}-${crypto.randomBytes(6).toString('hex')}`;
    const payment = await this.paymentModel.create({
      userId: new Types.ObjectId(userId),
      bookingId: booking._id,
      gateway: 'paystack',
      reference,
      amountMinor: price.amountMinor,
      currency: price.currency,
      status: 'initialized',
    });

    await this.bookingModel.updateOne(
      { _id: booking._id, status: { $in: ['held', 'pending_payment'] } },
      {
        $set: {
          status: 'pending_payment',
          reference,
          paymentId: payment._id,
          pricePolicyVersion: env().paymentPolicyVersion,
        },
        $inc: { version: 1 },
      },
    );

    try {
      const initialized = await this.paystack.initialize({
        email: user.email,
        amountMinor: price.amountMinor,
        currency: price.currency,
        reference,
        metadata: { bookingId: booking._id.toString() },
      });
      payment.authorizationUrl = initialized.authorizationUrl;
      payment.accessCode = initialized.accessCode;
      await payment.save();
    } catch (error) {
      payment.status = 'failed';
      payment.failureReason = 'provider_unavailable';
      await payment.save();
      throw error;
    }

    return {
      success: true,
      data: {
        payment: this.presentPayment(payment),
        reuse: false,
        amountMinor: price.amountMinor,
        currency: price.currency,
      },
      meta: this.meta(),
    };
  }

  /**
   * Paystack webhook. Failures are loud (401/503) so the provider retries; a
   * booking is only ever confirmed after a server-side verification whose
   * amount and currency match what this API quoted.
   */
  async handleWebhook(rawBody: Buffer | undefined, signature: string | undefined) {
    if (!this.paystack.isEnabled()) {
      throw new ServiceUnavailableException('Payment webhooks are disabled. No booking was changed.');
    }
    if (!this.paystack.verifyWebhookSignature(rawBody, signature)) {
      throw new UnauthorizedException('Invalid payment webhook signature');
    }

    let payload: { event?: string; data?: { id?: unknown; reference?: string; idempotency_key?: string } };
    try {
      payload = JSON.parse((rawBody as Buffer).toString('utf8'));
    } catch {
      throw new UnauthorizedException('Invalid payment webhook payload');
    }

    const eventName = String(payload?.event || 'unknown');
    const reference = payload?.data?.reference;
    const eventId = `${eventName}:${String(payload?.data?.id ?? reference ?? 'unknown')}`;

    let event: PaymentWebhookEventDocument;
    try {
      event = await this.eventModel.create({
        eventId,
        event: eventName,
        reference,
        payloadHash: this.paystack.payloadHash(rawBody as Buffer),
        outcome: 'RECEIVED',
        receivedAt: new Date(),
      });
    } catch (error) {
      if ((error as { code?: unknown })?.code === 11000) {
        return { success: true, data: { received: true, duplicate: true, status: 'DUPLICATE' }, meta: this.meta() };
      }
      throw error;
    }

    const finish = async (status: string, outcome: string, extra: Record<string, unknown> = {}) => {
      event.outcome = outcome;
      await event.save().catch(() => undefined);
      return { success: true, data: { received: true, status, ...extra }, meta: this.meta() };
    };

    if (eventName !== 'charge.success') return finish('IGNORED_EVENT', 'IGNORED_EVENT');
    if (!reference) return finish('MISSING_REFERENCE', 'MISSING_REFERENCE');

    const payment = await this.paymentModel.findOne({ reference });
    if (!payment) return finish('UNKNOWN_REFERENCE', 'UNKNOWN_REFERENCE');
    if (payment.status === 'succeeded') return finish('ALREADY_SUCCEEDED', 'ALREADY_SUCCEEDED');

    // Third-party callbacks are untrusted input: verify with the provider.
    const verification = await this.paystack.verify(reference);

    if (verification.status !== 'success') {
      payment.status = 'failed';
      payment.failureReason = `gateway_status_${verification.status}`;
      await payment.save();
      return finish('NOT_SUCCESSFUL', 'NOT_SUCCESSFUL');
    }

    if (verification.amountMinor !== payment.amountMinor || verification.currency !== payment.currency) {
      payment.status = 'failed';
      payment.failureReason = 'amount_or_currency_mismatch';
      payment.verifiedAmountMinor = verification.amountMinor ?? undefined;
      payment.verifiedCurrency = verification.currency ?? undefined;
      await payment.save();
      this.logger.warn(`Payment reference ${reference} rejected: amount/currency mismatch`);
      return finish('AMOUNT_MISMATCH', 'AMOUNT_MISMATCH');
    }

    payment.status = 'succeeded';
    payment.verifiedAmountMinor = verification.amountMinor;
    payment.verifiedCurrency = verification.currency;
    payment.verifiedAt = new Date();
    payment.gatewayTransactionId = verification.gatewayTransactionId;
    await payment.save();

    const booking = await this.bookingModel.findOneAndUpdate(
      { _id: payment.bookingId, status: { $in: ['held', 'pending_payment'] } },
      { $set: { status: 'confirmed', confirmedAt: new Date(), paymentId: payment._id }, $inc: { version: 1 } },
      { new: true },
    );

    if (!booking) {
      // The money arrived after the booking was cancelled or expired. Record the
      // payment truthfully and flag a manual refund decision; never silently confirm.
      await this.bookingModel.updateOne({ _id: payment.bookingId }, { $set: { refundStatus: 'pending_policy' } });
      return finish('PAYMENT_RECEIVED_BOOKING_CLOSED', 'PAYMENT_RECEIVED_BOOKING_CLOSED');
    }

    await this.slotModel.updateOne(
      { _id: booking.slotId },
      { $set: { status: 'booked' }, $unset: { heldBy: 1, holdExpiresAt: 1, holdId: 1 } },
    );
    return finish('CONFIRMED', 'CONFIRMED', { bookingId: booking._id.toString() });
  }

  async getBooking(userId: string, bookingId: string) {
    const booking = await this.bookingModel.findOne({ _id: new Types.ObjectId(bookingId), userId: new Types.ObjectId(userId) });
    if (!booking) throw new NotFoundException('Booking not found');
    const payment = booking.paymentId ? await this.paymentModel.findById(booking.paymentId).lean().exec() : null;
    return {
      success: true,
      data: {
        booking: this.presentBooking(booking),
        payment: payment ? this.presentPayment(payment as unknown as PaymentDocument) : null,
      },
      meta: this.meta(),
    };
  }

  async listBookings(userId: string, query: { cursor?: string; limit: number; status?: string }) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (query.status) filter.status = query.status;
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.bookingModel.find(filter).sort({ _id: -1 }).limit(query.limit + 1).exec();
    const hasNext = rows.length > query.limit;
    const bookings = rows.slice(0, query.limit);
    return {
      success: true,
      data: {
        bookings: bookings.map((booking) => this.presentBooking(booking)),
        nextCursor: hasNext ? bookings[bookings.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  /**
   * Owner-initiated cancellation. Refunds are not automated: a paid booking is
   * marked `pending_policy` until the approved refund policy is implemented.
   */
  async cancelBooking(userId: string, bookingId: string, reason?: string) {
    const booking = await this.bookingModel.findOne({ _id: new Types.ObjectId(bookingId), userId: new Types.ObjectId(userId) });
    if (!booking) throw new NotFoundException('Booking not found');
    if (!['held', 'pending_payment', 'confirmed'].includes(booking.status)) {
      throw new ConflictException(`A ${booking.status} booking cannot be cancelled`);
    }
    const now = new Date();
    if (booking.startsAt.getTime() <= now.getTime()) {
      throw new UnprocessableEntityException('A session that has started or passed cannot be cancelled here');
    }

    const payment = booking.paymentId ? await this.paymentModel.findById(booking.paymentId) : null;
    booking.status = 'cancelled';
    booking.cancelledAt = now;
    booking.cancellationReason = reason || 'Cancelled by the account owner';
    booking.refundStatus = payment?.status === 'succeeded' ? 'pending_policy' : 'not_required';
    booking.version += 1;
    await booking.save();

    await this.slotModel.updateOne(
      { _id: booking.slotId, status: { $in: ['held', 'booked'] } },
      { $set: { status: 'open' }, $unset: { heldBy: 1, holdExpiresAt: 1, holdId: 1 } },
    );
    await this.holdModel.updateOne({ _id: booking.holdId, status: 'held' }, { $set: { status: 'cancelled' } });

    return {
      success: true,
      data: {
        booking: this.presentBooking(booking),
        refund: {
          status: booking.refundStatus,
          message:
            booking.refundStatus === 'pending_policy'
              ? 'The refund policy is not yet approved, so no refund has been issued automatically.'
              : 'No payment was taken, so no refund is required.',
        },
      },
      meta: this.meta(),
    };
  }

  async getPayment(userId: string, paymentId: string) {
    const payment = await this.paymentModel.findOne({ _id: new Types.ObjectId(paymentId), userId: new Types.ObjectId(userId) });
    if (!payment) throw new NotFoundException('Payment not found');
    return { success: true, data: this.presentPayment(payment), meta: this.meta() };
  }

  /** Deterministic receipt for a confirmed, provider-verified booking. */
  async getReceipt(userId: string, bookingId: string) {
    const booking = await this.bookingModel.findOne({ _id: new Types.ObjectId(bookingId), userId: new Types.ObjectId(userId) });
    if (!booking) throw new NotFoundException('Booking not found');
    if (booking.status !== 'confirmed') {
      throw new UnprocessableEntityException('A receipt is available only for a confirmed booking');
    }
    const payment = booking.paymentId ? await this.paymentModel.findById(booking.paymentId).lean().exec() : null;
    if (!payment || payment.status !== 'succeeded') {
      throw new UnprocessableEntityException('A receipt is available only after verified payment');
    }

    const paidAt = payment.verifiedAt || booking.confirmedAt || (booking as any).createdAt || new Date();
    const issuedAt = new Date(paidAt as Date);
    return {
      success: true,
      data: {
        receiptNo: `OBR-${issuedAt.toISOString().slice(0, 10).replace(/-/g, '')}-${booking._id.toString().slice(-8).toUpperCase()}`,
        bookingId: booking._id.toString(),
        paymentId: payment._id.toString(),
        reference: payment.reference,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        sessionType: booking.sessionType,
        startsAt: booking.startsAt.toISOString(),
        endsAt: booking.endsAt.toISOString(),
        paidAt: issuedAt.toISOString(),
        refundStatus: booking.refundStatus,
        provider: payment.gateway,
      },
      meta: this.meta(),
    };
  }

  /** Clinician-side read of their own booked sessions. */
  async listClinicianBookings(clinicianUserId: string, query: { cursor?: string; limit: number }) {
    const clinician = await this.slotModel.db.collection('clinicians').findOne({ userId: new Types.ObjectId(clinicianUserId) });
    if (!clinician) throw new ForbiddenException('An active clinician profile is required');
    const filter: Record<string, unknown> = { clinicianId: clinician._id };
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.bookingModel.find(filter).sort({ _id: -1 }).limit(query.limit + 1).exec();
    const hasNext = rows.length > query.limit;
    const bookings = rows.slice(0, query.limit);
    return {
      success: true,
      data: { bookings: bookings.map((booking) => this.presentBooking(booking)), nextCursor: hasNext ? bookings[bookings.length - 1]._id.toString() : null },
      meta: this.meta(),
    };
  }
}
