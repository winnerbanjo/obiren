import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CareService } from './care.service';
import { Booking, BookingDocument, Payment, PaymentDocument, PromoCode, PromoCodeDocument } from '../../database/schemas/care.schema';
import { requireAdminRole } from '../admin/admin.service';
import { AuthenticatedUser } from '../../common/auth/request-user';

@Injectable()
export class PromotionsService {
  constructor(
    @InjectModel(PromoCode.name) private readonly promoModel: Model<PromoCodeDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    private readonly careService: CareService,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  /**
   * Quote a promotion against the server price. This never charges, redeems or
   * reserves anything: checkout still fails closed until an approved payment
   * and promotion policy exist, so `applied` is always false for now.
   */
  async validate(code: string, clinicianId: string, sessionType: string) {
    const promo = await this.promoModel
      .findOne({ code: code.trim().toUpperCase(), active: true })
      .lean()
      .exec();
    if (!promo) throw new NotFoundException('Promo code is not valid');
    if (promo.expiresAt && promo.expiresAt.getTime() <= Date.now()) {
      throw new NotFoundException('Promo code has expired');
    }
    if (promo.maxRedemptions !== undefined && promo.redemptions >= promo.maxRedemptions) {
      throw new ConflictException('Promo code has no redemptions remaining');
    }

    const price = await this.careService.priceFor(clinicianId, sessionType);
    const discountMinor = Math.round((price.amountMinor * promo.percentOff) / 100);
    return {
      success: true,
      data: {
        code: promo.code,
        percentOff: promo.percentOff,
        policyVersion: promo.policyVersion,
        originalAmountMinor: price.amountMinor,
        discountMinor,
        payableAmountMinor: Math.max(price.amountMinor - discountMinor, 0),
        currency: price.currency,
        applied: false,
        reason: 'promotion_policy_pending',
        message:
          'The discount is quoted only. Checkout does not apply promotions until the approved payment and promotion policy is configured; nothing was charged or reserved.',
        remainingRedemptions:
          promo.maxRedemptions === undefined ? null : Math.max(promo.maxRedemptions - promo.redemptions, 0),
      },
      meta: this.meta(),
    };
  }

  async create(adminUser: AuthenticatedUser, input: { code: string; percentOff: number; policyVersion: string; maxRedemptions?: number; expiresAt?: string }) {
    requireAdminRole(adminUser, ['super_admin', 'platform_admin']);
    const existing = await this.promoModel.findOne({ code: input.code }).lean().exec();
    if (existing) throw new ConflictException('A promo code with this code already exists');
    const promo = await this.promoModel.create({
      code: input.code,
      percentOff: input.percentOff,
      policyVersion: input.policyVersion,
      maxRedemptions: input.maxRedemptions,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
      active: true,
      redemptions: 0,
      createdByUserId: new Types.ObjectId(adminUser.sub),
    });
    return {
      success: true,
      data: {
        id: promo._id.toString(),
        code: promo.code,
        percentOff: promo.percentOff,
        policyVersion: promo.policyVersion,
        maxRedemptions: promo.maxRedemptions ?? null,
        expiresAt: promo.expiresAt ?? null,
        active: promo.active,
      },
      meta: this.meta(),
    };
  }

  /**
   * Entitlements are derived from persisted, provider-verified bookings. There
   * is no subscription catalog yet, so none is invented.
   */
  async subscriptionsFor(userId: string) {
    const owner = new Types.ObjectId(userId);
    const now = new Date();
    const [upcoming, completed, paidCount] = await Promise.all([
      this.bookingModel.find({ userId: owner, status: 'confirmed', startsAt: { $gte: now } }).sort({ startsAt: 1 }).limit(20).lean().exec(),
      this.bookingModel.find({ userId: owner, status: 'completed' }).sort({ startsAt: -1 }).limit(20).lean().exec(),
      this.paymentModel.countDocuments({ userId: owner, status: 'succeeded' }),
    ]);

    return {
      success: true,
      data: {
        subscription: {
          plan: null,
          status: 'none',
          catalog: 'pending_product_approval',
          message: 'No subscription products are published. Session access comes from confirmed bookings.',
        },
        entitlements: upcoming.map((booking) => ({
          bookingId: booking._id.toString(),
          sessionType: booking.sessionType,
          clinicianId: booking.clinicianId.toString(),
          startsAt: booking.startsAt.toISOString(),
          endsAt: booking.endsAt.toISOString(),
          source: 'confirmed_booking',
        })),
        usage: {
          upcomingSessions: upcoming.length,
          completedSessions: completed.length,
          verifiedPayments: paidCount,
        },
        policyPending: true,
      },
      meta: this.meta(),
    };
  }
}
