import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { env } from '../../config/env.validation';
import { missingConfigurationDetails } from '../../common/config/configuration-report';
import { AvailabilitySlot, AvailabilitySlotDocument, BookingHold, BookingHoldDocument, Clinician, ClinicianDocument } from '../../database/schemas/care.schema';

@Injectable()
export class CareService {
  constructor(
    @InjectModel(Clinician.name) private readonly clinicianModel: Model<ClinicianDocument>,
    @InjectModel(AvailabilitySlot.name) private readonly slotModel: Model<AvailabilitySlotDocument>,
    @InjectModel(BookingHold.name) private readonly holdModel: Model<BookingHoldDocument>,
  ) {}
  private meta() { return { requestId: `req_${Date.now()}` }; }

  private static readonly CURRENCY_BY_COUNTRY: Record<string, string> = {
    NG: 'NGN',
    GH: 'GHS',
    GB: 'GBP',
    US: 'USD',
  };

  private currencyFor(countryCode: string): string {
    return CareService.CURRENCY_BY_COUNTRY[countryCode] || 'NGN';
  }

  /** Public shape of a verified specialist, including priced session types. */
  private presentSpecialist(clinician: any) {
    return {
      id: clinician._id.toString(),
      displayName: clinician.displayName,
      profession: clinician.profession ?? null,
      bio: clinician.bio ?? null,
      specialties: clinician.specialties || [],
      languages: clinician.languages || [],
      certifications: clinician.certifications || [],
      countryCode: clinician.countryCode,
      currency: this.currencyFor(clinician.countryCode),
      feeBySessionType: clinician.feeBySessionType || {},
      verificationStatus: clinician.verificationStatus,
      ratingAverage: clinician.ratingAverage ?? null,
      ratingCount: clinician.ratingCount ?? 0,
    };
  }

  /** Cursor-paginated verified specialist catalog for the PRD `/specialists` contract. */
  async listSpecialists(filter: {
    countryCode?: string;
    specialty?: string;
    language?: string;
    sessionType?: string;
    cursor?: string;
    limit: number;
  }) {
    const query: Record<string, unknown> = { active: true, verificationStatus: 'verified' };
    if (filter.countryCode) query.countryCode = filter.countryCode;
    if (filter.specialty) query.specialties = filter.specialty;
    if (filter.language) query.languages = filter.language;
    if (filter.sessionType) query[`feeBySessionType.${filter.sessionType}`] = { $gt: 0 };
    if (filter.cursor) query._id = { $lt: new Types.ObjectId(filter.cursor) };

    const rows = await this.clinicianModel.find(query).sort({ _id: -1 }).limit(filter.limit + 1).lean().exec();
    const hasNext = rows.length > filter.limit;
    const specialists = rows.slice(0, filter.limit).map((row) => this.presentSpecialist(row));
    return {
      success: true,
      data: { specialists, nextCursor: hasNext ? specialists[specialists.length - 1].id : null },
      meta: this.meta(),
    };
  }

  async getSpecialist(id: string) {
    const clinician = await this.clinicianModel
      .findOne({ _id: new Types.ObjectId(id), active: true, verificationStatus: 'verified' })
      .lean()
      .exec();
    if (!clinician) throw new NotFoundException('Specialist not found');
    return { success: true, data: this.presentSpecialist(clinician), meta: this.meta() };
  }

  async listSpecialistSlots(id: string, filter: { from: Date; to: Date; sessionType?: string }) {
    const clinician = await this.clinicianModel
      .findOne({ _id: new Types.ObjectId(id), active: true, verificationStatus: 'verified' })
      .lean()
      .exec();
    if (!clinician) throw new NotFoundException('Specialist not found');

    const slots = await this.slotModel
      .find({
        clinicianId: clinician._id,
        startsAt: { $gte: filter.from, $lte: filter.to },
        ...(filter.sessionType ? { sessionType: filter.sessionType } : {}),
        $or: [{ status: 'open' }, { status: 'held', holdExpiresAt: { $lte: new Date() } }],
      })
      .sort({ startsAt: 1 })
      .limit(200)
      .lean()
      .exec();

    return {
      success: true,
      data: {
        specialist: this.presentSpecialist(clinician),
        slots: slots.map((slot) => ({
          id: slot._id.toString(),
          startsAt: slot.startsAt,
          endsAt: slot.endsAt,
          sessionType: slot.sessionType,
          available: true,
        })),
      },
      meta: this.meta(),
    };
  }

  /**
   * Server-side price lookup for a slot's session type. A missing approved
   * price is a hard stop: checkout must never guess an amount.
   */
  async priceFor(clinicianId: Types.ObjectId | string, sessionType: string): Promise<{ amountMinor: number; currency: string }> {
    const clinician = await this.clinicianModel.findOne({ _id: clinicianId, active: true, verificationStatus: 'verified' }).lean().exec();
    if (!clinician) throw new NotFoundException('Specialist not found');
    const fees = (clinician.feeBySessionType || {}) as Record<string, number | undefined>;
    const amountMinor = fees[sessionType];
    if (!Number.isInteger(amountMinor) || (amountMinor as number) <= 0) {
      throw new ServiceUnavailableException(
        'Scheduling for this session type is unavailable until an approved price is configured. No payment was attempted.',
      );
    }
    return { amountMinor: amountMinor as number, currency: this.currencyFor(clinician.countryCode) };
  }

  // ---------------- clinician-owned availability ----------------

  /** The caller's own active, verified clinician profile. */
  private async ownClinician(userId: string) {
    const clinician = await this.clinicianModel
      .findOne({ userId: new Types.ObjectId(userId), active: true, verificationStatus: 'verified' })
      .lean()
      .exec();
    if (!clinician) throw new ForbiddenException('An active, verified clinician profile is required');
    return clinician;
  }

  private presentSlot(slot: any) {
    return {
      id: slot._id.toString(),
      startsAt: new Date(slot.startsAt).toISOString(),
      endsAt: new Date(slot.endsAt).toISOString(),
      sessionType: slot.sessionType,
      status: slot.status,
      holdExpiresAt: slot.holdExpiresAt ? new Date(slot.holdExpiresAt).toISOString() : null,
    };
  }

  /** A slot can only be changed while it is unbooked and not actively held. */
  private assertSlotEditable(slot: { status: string; holdExpiresAt?: Date | null }) {
    const holdExpired = Boolean(slot.holdExpiresAt && new Date(slot.holdExpiresAt).getTime() <= Date.now());
    if (slot.status !== 'open' && !(slot.status === 'held' && holdExpired)) {
      throw new ConflictException('Only open availability can be changed while a slot is held or booked');
    }
  }

  async listClinicianSlots(
    userId: string,
    query: { from?: string; to?: string; status?: string; limit: number },
  ): Promise<Record<string, unknown>> {
    const clinician = await this.ownClinician(userId);
    const startsAt: Record<string, Date> = { $gte: query.from ? new Date(query.from) : new Date() };
    if (query.to) startsAt.$lte = new Date(query.to);
    const filter: Record<string, unknown> = { clinicianId: clinician._id, startsAt };
    if (query.status) filter.status = query.status;
    const slots = await this.slotModel.find(filter).sort({ startsAt: 1 }).limit(query.limit).lean().exec();
    return {
      success: true,
      data: { specialistId: clinician._id.toString(), slots: slots.map((slot) => this.presentSlot(slot)) },
      meta: this.meta(),
    };
  }

  async createClinicianSlot(userId: string, input: { startsAt: string; endsAt: string; sessionType: string }) {
    const clinician = await this.ownClinician(userId);
    const startsAt = new Date(input.startsAt); const endsAt = new Date(input.endsAt);
    if (startsAt <= new Date()) throw new BadRequestException('Availability must start in the future');
    if (startsAt.getTime() % 60000 || endsAt.getTime() % 60000) throw new BadRequestException('Availability must use whole-minute boundaries');
    const slot = await this.slotModel.create({ clinicianId: clinician._id, startsAt, endsAt, sessionType: input.sessionType, status: 'open' });
    return { success: true, data: this.presentSlot(slot.toObject()), meta: this.meta() };
  }

  async updateClinicianSlot(
    userId: string,
    slotId: string,
    input: { startsAt?: string; endsAt?: string; sessionType?: string },
  ): Promise<Record<string, unknown>> {
    const clinician = await this.ownClinician(userId);
    const slot = await this.slotModel.findOne({ _id: new Types.ObjectId(slotId), clinicianId: clinician._id }).exec();
    if (!slot) throw new NotFoundException('Availability slot not found for this clinician');
    this.assertSlotEditable(slot);

    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date(slot.startsAt);
    const endsAt = input.endsAt ? new Date(input.endsAt) : new Date(slot.endsAt);
    if (startsAt <= new Date()) throw new BadRequestException('Availability must start in the future');
    if (endsAt <= startsAt) throw new BadRequestException('endsAt must follow startsAt');
    if (startsAt.getTime() % 60000 || endsAt.getTime() % 60000) throw new BadRequestException('Availability must use whole-minute boundaries');
    if (endsAt.getTime() - startsAt.getTime() > 8 * 60 * 60 * 1000) throw new BadRequestException('Slot duration cannot exceed eight hours');

    slot.startsAt = startsAt;
    slot.endsAt = endsAt;
    if (input.sessionType) slot.sessionType = input.sessionType;
    // A previously held (now expired) slot becomes bookable again.
    slot.status = 'open';
    slot.heldBy = undefined;
    slot.holdExpiresAt = undefined;
    slot.holdId = undefined;
    await slot.save();

    return { success: true, data: this.presentSlot(slot.toObject()), meta: this.meta() };
  }

  async deleteClinicianSlot(userId: string, slotId: string): Promise<Record<string, unknown>> {
    const clinician = await this.ownClinician(userId);
    const slot = await this.slotModel.findOne({ _id: new Types.ObjectId(slotId), clinicianId: clinician._id }).exec();
    if (!slot) throw new NotFoundException('Availability slot not found for this clinician');
    this.assertSlotEditable(slot);
    // Hard delete: the slot never held a booking, and the unique
    // (clinicianId, startsAt) index must be freed so the time can be republished.
    await this.slotModel.deleteOne({ _id: slot._id, clinicianId: clinician._id });
    return { success: true, data: { slotId, deleted: true }, meta: this.meta() };
  }

  async listAvailability(filter: { from: Date; to: Date; countryCode?: string }): Promise<Record<string, unknown>> {
    const clinicians = await this.clinicianModel.find({ active: true, verificationStatus: 'verified', ...(filter.countryCode ? { countryCode: filter.countryCode } : {}) }).select('_id displayName specialties countryCode').lean().exec();
    const ids = clinicians.map((item) => item._id);
    const slots = await this.slotModel.find({ clinicianId: { $in: ids }, startsAt: { $gte: filter.from, $lte: filter.to }, $or: [{ status: 'open' }, { status: 'held', holdExpiresAt: { $lte: new Date() } }] }).sort({ startsAt: 1 }).limit(500).lean().exec();
    const byId = new Map(clinicians.map((item) => [item._id.toString(), item]));
    return { success: true, data: slots.map((slot) => ({ ...slot, clinician: byId.get(slot.clinicianId.toString()) })), meta: this.meta() };
  }

  async holdSlot(userId: string, slotId: string) {
    const now = new Date(); const owner = new Types.ObjectId(userId);
    const expiresAt = new Date(now.getTime() + 10 * 60 * 1000);
    const slot = await this.slotModel.findOneAndUpdate(
      { _id: new Types.ObjectId(slotId), startsAt: { $gt: expiresAt }, $or: [{ status: 'open' }, { status: 'held', holdExpiresAt: { $lte: now } }] },
      { $set: { status: 'held', heldBy: owner, holdExpiresAt: expiresAt }, $unset: { holdId: 1 } },
      { new: true },
    ).exec();
    if (!slot) throw new ConflictException('Availability is no longer open');
    let hold: BookingHoldDocument | null = null;
    try {
      hold = await this.holdModel.create({ userId: owner, clinicianId: slot.clinicianId, slotId: slot._id, status: 'held', expiresAt });
      const linked = await this.slotModel.updateOne({ _id: slot._id, status: 'held', heldBy: owner, holdExpiresAt: expiresAt }, { $set: { holdId: hold._id } });
      if (!linked.matchedCount) throw new ConflictException('The slot hold expired before it could be finalized');
      return { success: true, data: { holdId: hold._id.toString(), slotId: slot._id.toString(), status: 'held', expiresAt, bookingEnabled: false, message: 'Temporary slot hold only; no appointment or payment has been confirmed.' }, meta: this.meta() };
    } catch (error) {
      await this.slotModel.updateOne({ _id: slot._id, heldBy: owner, status: 'held', holdExpiresAt: expiresAt }, { $set: { status: 'open' }, $unset: { heldBy: 1, holdExpiresAt: 1, holdId: 1 } });
      if (hold) await this.holdModel.updateOne({ _id: hold._id, status: 'held' }, { $set: { status: 'cancelled' } });
      throw error;
    }
  }

  async cancelHold(userId: string, holdId: string) {
    const hold = await this.holdModel.findOneAndUpdate({ _id: new Types.ObjectId(holdId), userId: new Types.ObjectId(userId), status: 'held', expiresAt: { $gt: new Date() } }, { $set: { status: 'cancelled' } }, { new: true }).exec();
    if (!hold) throw new NotFoundException('Active booking hold not found');
    await this.slotModel.updateOne({ _id: hold.slotId, holdId: hold._id, status: 'held' }, { $set: { status: 'open' }, $unset: { heldBy: 1, holdExpiresAt: 1, holdId: 1 } });
    return { success: true, data: { holdId, status: 'cancelled' }, meta: this.meta() };
  }

  async initializePayment(): Promise<never> {
    if (!env().paymentEnabled || !process.env.PAYSTACK_SECRET_KEY) {
      throw new ServiceUnavailableException({
        success: false,
        error: {
          code: 'PROVIDER_UNAVAILABLE',
          message: 'Checkout is disabled until payment credentials and an approved pricing/refund policy are configured.',
          details: missingConfigurationDetails(
            ['PAYMENT_ENABLED', 'PAYMENT_POLICY_VERSION', 'PAYSTACK_SECRET_KEY'],
            'Checkout and payments',
          ),
        },
      });
    }
    throw new ServiceUnavailableException('Checkout integration is not enabled; no payment was attempted');
  }

  async verifyWebhook(signature: string, body: Buffer): Promise<never> {
    const secret = env().paymentEnabled ? process.env.PAYSTACK_SECRET_KEY : undefined;
    const expected = secret ? crypto.createHmac('sha512', secret).update(body).digest('hex') : '';
    const providedBytes = Buffer.from(signature || '', 'utf8'); const expectedBytes = Buffer.from(expected, 'utf8');
    if (!expected || providedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(providedBytes, expectedBytes)) throw new UnauthorizedException('Invalid payment webhook signature');
    throw new ServiceUnavailableException('Payment webhook processing is disabled; no booking or entitlement was changed');
  }
}
