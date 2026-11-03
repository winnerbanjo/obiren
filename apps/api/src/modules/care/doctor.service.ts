import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AvailabilitySlot,
  AvailabilitySlotDocument,
  Booking,
  BookingDocument,
  Clinician,
  ClinicianDocument,
  DoctorAvailabilityRule,
  DoctorAvailabilityRuleDocument,
  DoctorTimeOff,
  DoctorTimeOffDocument,
  Payment,
  PaymentDocument,
} from '../../database/schemas/care.schema';
import { InAppNotification, InAppNotificationDocument } from '../../database/schemas/notification.schema';
import { User, UserDocument, UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { MailService } from '../mail/mail.service';
import { AvailabilityService, SLOT_HORIZON_DAYS, formatMinutes } from './availability.service';
import { localDateKey, isValidTimeZone } from '../../common/time/zoned-time';

const EDITABLE_PROFILE_FIELDS = [
  'displayName',
  'professionalTitle',
  'profession',
  'bio',
  'photoUrl',
  'languages',
  'specialties',
  'clinicName',
  'clinicAddress',
  'phoneNumber',
  'yearsOfExperience',
] as const;

/** Fields that must be re-reviewed by Obiren staff before they go live. */
const CREDENTIAL_FIELDS = ['licenceNumber', 'certifications'] as const;

/** Statuses a doctor may still act on. */
const OPEN_STATUSES = ['pending', 'confirmed', 'reschedule_requested'];

/**
 * Providers a doctor may bring their own consultation room from.
 *
 * The link is stored and handed to the patient, so an arbitrary URL would be a
 * phishing delivery mechanism: only these hosts are accepted, matched exactly
 * or as a parent domain (zoom.us also covers us02web.zoom.us).
 */
const MEETING_LINK_HOSTS = ['meet.google.com', 'zoom.us', 'teams.microsoft.com', 'teams.live.com'];

/** Statuses where a consultation link is still meaningful to the patient. */
const MEETING_LINK_STATUSES = ['pending', 'confirmed', 'reschedule_requested'];

const STATUS_LABELS: Record<string, string> = {
  held: 'Awaiting payment',
  pending_payment: 'Awaiting payment',
  pending: 'Pending your confirmation',
  confirmed: 'Confirmed',
  reschedule_requested: 'Reschedule requested',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
  completed: 'Completed',
  no_show: 'No-show',
  expired: 'Expired',
};

@Injectable()
export class DoctorService {
  constructor(
    @InjectModel(Clinician.name) private readonly clinicianModel: Model<ClinicianDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(AvailabilitySlot.name) private readonly slotModel: Model<AvailabilitySlotDocument>,
    @InjectModel(DoctorAvailabilityRule.name) private readonly ruleModel: Model<DoctorAvailabilityRuleDocument>,
    @InjectModel(DoctorTimeOff.name) private readonly timeOffModel: Model<DoctorTimeOffDocument>,
    @InjectModel(InAppNotification.name) private readonly notificationModel: Model<InAppNotificationDocument>,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private readonly profileModel: Model<UserProfileDocument>,
    @InjectModel(Payment.name) private readonly paymentModel: Model<PaymentDocument>,
    @InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>,
    private readonly availability: AvailabilityService,
    private readonly mail: MailService,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  /**
   * The caller's own clinician profile. Doctor identity comes from the
   * authenticated role plus the profile linked to that user id — never from a
   * URL parameter — so cross-doctor access is impossible by construction.
   */
  async ownDoctor(userId: string): Promise<ClinicianDocument> {
    if (!Types.ObjectId.isValid(userId)) throw new ForbiddenException('A clinician account is required');
    const objectId = new Types.ObjectId(userId);
    // These two lookups are independent. Running them together removes one
    // database round-trip from every Doctor Portal request.
    const [clinician, user] = await Promise.all([
      this.clinicianModel.findOne({ userId: objectId }),
      this.userModel.findById(userId).select('status roles').lean().exec(),
    ]);
    if (!clinician) throw new ForbiddenException('No clinician profile is linked to this account');
    if (!user || !(user.roles || []).includes('clinician')) {
      throw new ForbiddenException('This account does not hold the clinician role');
    }
    if (['suspended', 'restricted', 'deleted'].includes(user.status)) {
      throw new ForbiddenException('This account is not permitted to use the Doctor Portal');
    }
    return clinician;
  }

  private accountStatus(clinician: ClinicianDocument, userStatus?: string): string {
    if (userStatus === 'suspended') return 'suspended';
    if (userStatus === 'pending_verification') return 'invited';
    if (clinician.active && clinician.verificationStatus === 'verified') return 'active';
    return 'inactive';
  }

  private async presentProfile(clinician: ClinicianDocument) {
    const user = await this.userModel.findById(clinician.userId).select('email status emailVerifiedAt').lean().exec();
    const userStatus = user?.status;
    return {
      id: clinician._id.toString(),
      userId: clinician.userId.toString(),
      email: user?.email ?? null,
      displayName: clinician.displayName,
      professionalTitle: clinician.professionalTitle ?? clinician.profession ?? null,
      profession: clinician.profession ?? null,
      specialities: clinician.specialties || [],
      specialties: clinician.specialties || [],
      languages: clinician.languages || [],
      certifications: clinician.certifications || [],
      licenceNumber: clinician.licenceNumber ?? null,
      yearsOfExperience: clinician.yearsOfExperience ?? null,
      bio: clinician.bio ?? null,
      photoUrl: clinician.photoUrl ?? null,
      clinicName: clinician.clinicName ?? null,
      clinicAddress: clinician.clinicAddress ?? null,
      phoneNumber: clinician.phoneNumber ?? null,
      countryCode: clinician.countryCode,
      timeZone: this.availability.timeZoneFor(clinician),
      consultationDurationMinutes: clinician.consultationDurationMinutes,
      bufferMinutes: clinician.bufferMinutes,
      bookingApprovalMode: clinician.bookingApprovalMode,
      verificationStatus: clinician.verificationStatus,
      credentialReviewRequired: Boolean(clinician.credentialReviewRequired),
      accountStatus: this.accountStatus(clinician, userStatus),
      listed: Boolean(clinician.active && clinician.verificationStatus === 'verified' && userStatus === 'active'),
      // Filter out legacy `_id` keys written before the schema set `_id: false`.
      feeBySessionType: {
        clinic: clinician.feeBySessionType?.clinic,
        audio: clinician.feeBySessionType?.audio,
        video: clinician.feeBySessionType?.video,
        text: clinician.feeBySessionType?.text,
      },
      emailVerified: Boolean(user?.emailVerifiedAt),
    };
  }

  async getProfile(userId: string) {
    const clinician = await this.ownDoctor(userId);
    return { success: true, data: await this.presentProfile(clinician), meta: this.meta() };
  }

  /**
   * Doctor-editable profile. Account status, verification state, listing
   * approval and fees stay admin-controlled. A credential change flags the
   * profile for review and removes it from public discovery until re-approved.
   */
  async updateProfile(userId: string, input: Record<string, unknown>) {
    const clinician = await this.ownDoctor(userId);
    const updates: Record<string, unknown> = {};
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (input[field] !== undefined) updates[field] = input[field];
    }
    const credentialChanged = CREDENTIAL_FIELDS.some((field) => input[field] !== undefined);

    if (updates.displayName !== undefined) clinician.displayName = String(updates.displayName);
    for (const field of EDITABLE_PROFILE_FIELDS) {
      if (field === 'displayName' || updates[field] === undefined) continue;
      (clinician as unknown as Record<string, unknown>)[field] = updates[field];
    }
    if (updates.phoneNumber !== undefined && updates.phoneNumber !== null) {
      const phone = String(updates.phoneNumber).replace(/[^\d+]/g, '');
      if (!/^\+?\d{7,15}$/.test(phone)) throw new BadRequestException('Enter a valid phone number');
      clinician.phoneNumber = phone;
    }

    let credentialReviewTriggered = false;
    if (credentialChanged) {
      if (input.licenceNumber !== undefined) {
        const licence = String(input.licenceNumber || '').trim();
        if (licence.length > 40) throw new BadRequestException('Licence number is too long');
        const duplicate = licence
          ? await this.clinicianModel.findOne({ licenceNumber: licence, _id: { $ne: clinician._id } }).lean().exec()
          : null;
        if (duplicate) throw new ConflictException('That licence number is already registered to another doctor');
        clinician.licenceNumber = licence || undefined;
      }
      if (Array.isArray(input.certifications)) {
        clinician.certifications = (input.certifications as string[]).map((item) => String(item).slice(0, 160));
      }
      credentialReviewTriggered = clinician.verificationStatus === 'verified';
      if (credentialReviewTriggered) {
        clinician.verificationStatus = 'pending';
        clinician.credentialReviewRequired = true;
        clinician.active = false;
      }
    }
    await clinician.save();

    await this.auditModel.create({
      actorUserId: new Types.ObjectId(userId),
      actorRole: 'clinician',
      action: 'UPDATE_DOCTOR_PROFILE',
      module: 'care',
      details: `Doctor ${clinician._id} updated profile (credential review: ${credentialReviewTriggered})`,
      timestamp: new Date(),
    });

    return {
      success: true,
      data: {
        profile: await this.presentProfile(clinician),
        credentialReviewTriggered,
        message: credentialReviewTriggered
          ? 'Your credential changes were submitted for review. Your profile is hidden from discovery until Obiren approves them.'
          : 'Profile updated.',
      },
      meta: this.meta(),
    };
  }

  // ---------------- appointments ----------------

  private async patientSummaries(userIds: Types.ObjectId[]) {
    const unique = Array.from(new Set(userIds.map((id) => id.toString()))).map((id) => new Types.ObjectId(id));
    if (unique.length === 0) return new Map<string, { displayName: string; phoneNumber: string | null }>();
    const profiles = await this.profileModel
      .find({ userId: { $in: unique } })
      .select('userId displayName firstName lastName phoneNumber')
      .lean()
      .exec();
    const map = new Map<string, { displayName: string; phoneNumber: string | null }>();
    for (const profile of profiles) {
      const name =
        profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Patient';
      map.set(profile.userId.toString(), { displayName: name, phoneNumber: profile.phoneNumber ?? null });
    }
    return map;
  }

  private presentAppointment(
    booking: BookingDocument | (Booking & { _id: Types.ObjectId }),
    patient?: { displayName: string; phoneNumber: string | null },
    extra: { paymentStatus?: string | null } = {},
  ) {
    const createdAt = (booking as unknown as { createdAt?: Date }).createdAt;
    return {
      id: booking._id.toString(),
      reference: booking.reference ?? `OBR-${booking._id.toString().slice(-8).toUpperCase()}`,
      status: booking.status,
      statusLabel: STATUS_LABELS[booking.status] ?? booking.status,
      sessionType: booking.sessionType,
      startsAt: booking.startsAt.toISOString(),
      endsAt: booking.endsAt.toISOString(),
      timeZone: booking.timeZone ?? null,
      durationMinutes: Math.round((booking.endsAt.getTime() - booking.startsAt.getTime()) / 60_000),
      amountMinor: booking.amountMinor,
      currency: booking.currency,
      paymentStatus: extra.paymentStatus ?? null,
      refundStatus: booking.refundStatus,
      patient: patient ?? null,
      patientNote: booking.patientNote ?? null,
      cancellationReason: booking.cancellationReason ?? null,
      rejectionReason: booking.rejectionReason ?? null,
      createdAt: createdAt ? createdAt.toISOString() : null,
      confirmedAt: booking.confirmedAt ? booking.confirmedAt.toISOString() : null,
      completedAt: booking.completedAt ? booking.completedAt.toISOString() : null,
      cancelledAt: booking.cancelledAt ? booking.cancelledAt.toISOString() : null,
      rejectedAt: booking.rejectedAt ? booking.rejectedAt.toISOString() : null,
      noShowAt: booking.noShowAt ? booking.noShowAt.toISOString() : null,
      rescheduledFrom: (booking.rescheduledFrom || []).map((entry) => ({
        startsAt: new Date(entry.startsAt).toISOString(),
        endsAt: new Date(entry.endsAt).toISOString(),
        at: new Date(entry.at).toISOString(),
      })),
      statusHistory: (booking.statusHistory || []).map((entry) => ({
        from: entry.from ?? null,
        to: entry.to,
        actorRole: entry.actorRole,
        reason: entry.reason ?? null,
        at: new Date(entry.at).toISOString(),
      })),
      meetingUrl: booking.meetingUrl ?? null,
      meetingUrlUpdatedAt: booking.meetingUrlUpdatedAt ? new Date(booking.meetingUrlUpdatedAt).toISOString() : null,
      meetingLinkEditable: MEETING_LINK_STATUSES.includes(booking.status),
      actions: this.allowedActions(booking.status, booking.startsAt),
    };
  }

  /**
   * Attach or clear the doctor's own meeting link on one of their appointments.
   *
   * Obiren does not run the call: the doctor brings a Google Meet, Zoom or
   * Microsoft Teams room and this stores the link against the booking the
   * patient already owns, so both sides read the same authoritative record.
   * Ownership comes from the `clinicianId` filter - another doctor's booking id
   * is reported as not found, never as forbidden.
   */
  async setMeetingLink(userId: string, bookingId: string, url: string | null) {
    const clinician = await this.ownDoctor(userId);
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundException('Appointment not found');

    const booking = await this.bookingModel.findOne({
      _id: new Types.ObjectId(bookingId),
      clinicianId: clinician._id,
    });
    if (!booking) throw new NotFoundException('Appointment not found');

    if (!MEETING_LINK_STATUSES.includes(booking.status)) {
      throw new ConflictException(`A ${booking.status} appointment cannot carry a consultation link`);
    }

    const now = new Date();
    const previous = booking.meetingUrl ?? null;
    const next = url === null ? null : this.normaliseMeetingUrl(url);

    if (next === previous) {
      // Idempotent: saving the same link twice must not message the patient again.
      return this.meetingLinkResponse(booking);
    }

    if (next === null) {
      booking.set('meetingUrl', undefined);
    } else {
      booking.meetingUrl = next;
    }
    booking.meetingUrlUpdatedAt = now;
    booking.meetingUrlUpdatedBy = new Types.ObjectId(userId);
    await booking.save();

    // In-app event plus best-effort email. A provider outage must never fail or
    // undo the appointment change, so the result is reported, not thrown.
    await this.notifyPatient(
      booking,
      next ? 'APPOINTMENT_LINK_ADDED' : 'APPOINTMENT_LINK_REMOVED',
      next ? 'Your consultation link is ready' : 'Consultation link removed',
      next
        ? `Your doctor added the link for your ${booking.sessionType} consultation. Open the appointment to join.`
        : 'Your doctor removed the consultation link for this appointment. They will share a new one if the session goes ahead.',
    ).catch(() => undefined);

    return this.meetingLinkResponse(booking);
  }

  private async meetingLinkResponse(booking: BookingDocument) {
    const patients = await this.patientSummaries([booking.userId]);
    return {
      success: true,
      data: this.presentAppointment(booking, patients.get(booking.userId.toString())),
      meta: this.meta(),
    };
  }

  /**
   * Accept only a shareable https link from a recognised provider.
   *
   * Rejects `javascript:`, plain http, credentials embedded in the URL and
   * lookalike hosts (`meet.google.com.evil.example`), because whatever passes
   * here is displayed to a patient as a trusted way into their consultation.
   */
  private normaliseMeetingUrl(raw: string): string {
    let parsed: URL;
    try {
      parsed = new URL(raw.trim());
    } catch {
      throw new BadRequestException('That is not a valid link. Paste the full meeting URL.');
    }

    if (parsed.protocol !== 'https:') {
      throw new BadRequestException('The meeting link must start with https://');
    }
    if (parsed.username || parsed.password) {
      throw new BadRequestException('Remove any username or password from the meeting link');
    }

    const host = parsed.hostname.toLowerCase();
    const allowed = MEETING_LINK_HOSTS.some((domain) => host === domain || host.endsWith(`.${domain}`));
    if (!allowed) {
      throw new BadRequestException(
        `Only ${MEETING_LINK_HOSTS.join(', ')} links are accepted. Create the room with one of those providers.`,
      );
    }

    return parsed.toString();
  }

  /** Server-computed action list so the portal never offers an invalid action. */
  private allowedActions(status: string, startsAt: Date) {
    const future = startsAt.getTime() > Date.now();
    return {
      confirm: status === 'pending',
      reject: status === 'pending',
      cancel: OPEN_STATUSES.includes(status) && future,
      reschedule: OPEN_STATUSES.includes(status) && future,
      complete: status === 'confirmed' && !future,
      noShow: status === 'confirmed' && !future,
    };
  }

  async listAppointments(
    userId: string,
    query: { status?: string; from?: string; to?: string; sessionType?: string; q?: string; cursor?: string; limit: number },
  ) {
    const clinician = await this.ownDoctor(userId);
    const filter: Record<string, unknown> = { clinicianId: clinician._id };

    if (query.sessionType) filter.sessionType = query.sessionType;
    if (query.status) {
      const statuses = query.status.split(',').map((value) => value.trim()).filter(Boolean);
      filter.status = { $in: statuses };
    }
    const startsAt: Record<string, Date> = {};
    if (query.from) startsAt.$gte = new Date(query.from);
    if (query.to) startsAt.$lte = new Date(query.to);
    if (Object.keys(startsAt).length) filter.startsAt = startsAt;
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };

    if (query.q) {
      // Search stays inside this doctor's own bookings: patient ids are resolved
      // first, then combined with `clinicianId` below.
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const matches = await this.profileModel
        .find({
          $or: [
            { displayName: { $regex: escaped, $options: 'i' } },
            { firstName: { $regex: escaped, $options: 'i' } },
            { lastName: { $regex: escaped, $options: 'i' } },
          ],
        })
        .select('userId')
        .limit(200)
        .lean()
        .exec();
      filter.$or = [
        { reference: { $regex: escaped, $options: 'i' } },
        { userId: { $in: matches.map((profile) => profile.userId) } },
      ];
    }

    const rows = await this.bookingModel.find(filter).sort({ startsAt: -1 }).limit(query.limit + 1).exec();
    const hasNext = rows.length > query.limit;
    const bookings = rows.slice(0, query.limit);
    const patients = await this.patientSummaries(bookings.map((booking) => booking.userId));
    return {
      success: true,
      data: {
        appointments: bookings.map((booking) =>
          this.presentAppointment(booking, patients.get(booking.userId.toString())),
        ),
        nextCursor: hasNext ? bookings[bookings.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  async getAppointment(userId: string, bookingId: string) {
    const clinician = await this.ownDoctor(userId);
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundException('Appointment not found');
    const booking = await this.bookingModel.findOne({ _id: new Types.ObjectId(bookingId), clinicianId: clinician._id });
    if (!booking) throw new NotFoundException('Appointment not found');
    const patients = await this.patientSummaries([booking.userId]);
    const payment = booking.paymentId ? await this.paymentModel.findById(booking.paymentId).select('status').lean().exec() : null;
    return {
      success: true,
      data: this.presentAppointment(booking, patients.get(booking.userId.toString()), {
        paymentStatus: payment?.status ?? null,
      }),
      meta: this.meta(),
    };
  }

  private async transition(
    clinician: ClinicianDocument,
    bookingId: string,
    allowedFrom: string[],
    to: string,
    reason?: string,
  ) {
    if (!Types.ObjectId.isValid(bookingId)) throw new NotFoundException('Appointment not found');
    const booking = await this.bookingModel.findOne({ _id: new Types.ObjectId(bookingId), clinicianId: clinician._id });
    if (!booking) throw new NotFoundException('Appointment not found');
    if (!allowedFrom.includes(booking.status)) {
      throw new ConflictException(
        `This appointment is ${STATUS_LABELS[booking.status] ?? booking.status} and cannot be moved to ${to.replace('_', ' ')}`,
      );
    }
    booking.statusHistory = [
      ...(booking.statusHistory || []),
      {
        from: booking.status,
        to,
        actorUserId: clinician.userId,
        actorRole: 'clinician',
        reason,
        at: new Date(),
      },
    ];
    booking.status = to;
    booking.version += 1;
    return booking;
  }

  private async releaseSlot(booking: BookingDocument) {
    await this.slotModel.updateOne(
      { _id: booking.slotId, status: { $in: ['held', 'booked'] } },
      { $set: { status: 'open' }, $unset: { heldBy: 1, holdExpiresAt: 1, holdId: 1 } },
    );
  }

  async confirmAppointment(userId: string, bookingId: string) {
    const clinician = await this.ownDoctor(userId);
    const booking = await this.transition(clinician, bookingId, ['pending'], 'confirmed');
    if (booking.startsAt.getTime() <= Date.now()) {
      throw new UnprocessableEntityException('This appointment has already started and cannot be confirmed');
    }
    booking.confirmedAt = new Date();
    await booking.save();
    await this.slotModel.updateOne({ _id: booking.slotId }, { $set: { status: 'booked' } });
    await this.notifyPatient(booking, 'APPOINTMENT_CONFIRMED', 'Appointment confirmed', 'Your appointment has been confirmed by your doctor.');
    return { success: true, data: this.presentAppointment(booking), meta: this.meta() };
  }

  async rejectAppointment(userId: string, bookingId: string, reason: string) {
    const clinician = await this.ownDoctor(userId);
    const booking = await this.transition(clinician, bookingId, ['pending'], 'rejected', reason);
    booking.rejectedAt = new Date();
    booking.rejectionReason = reason;
    const payment = booking.paymentId ? await this.paymentModel.findById(booking.paymentId).select('status').lean().exec() : null;
    booking.refundStatus = payment?.status === 'succeeded' ? 'pending_policy' : 'not_required';
    await booking.save();
    await this.releaseSlot(booking);
    await this.notifyPatient(booking, 'APPOINTMENT_REJECTED', 'Appointment request declined', `Your doctor could not take this appointment: ${reason}`);
    return { success: true, data: this.presentAppointment(booking), meta: this.meta() };
  }

  async cancelAppointment(userId: string, bookingId: string, reason: string) {
    const clinician = await this.ownDoctor(userId);
    const booking = await this.transition(clinician, bookingId, OPEN_STATUSES, 'cancelled', reason);
    booking.cancelledAt = new Date();
    booking.cancellationReason = `Cancelled by your doctor: ${reason}`;
    const payment = booking.paymentId ? await this.paymentModel.findById(booking.paymentId).select('status').lean().exec() : null;
    booking.refundStatus = payment?.status === 'succeeded' ? 'pending_policy' : 'not_required';
    await booking.save();
    await this.releaseSlot(booking);
    await this.notifyPatient(booking, 'APPOINTMENT_CANCELLED', 'Appointment cancelled', `Your doctor cancelled this appointment: ${reason}`);
    return { success: true, data: this.presentAppointment(booking), meta: this.meta() };
  }

  async completeAppointment(userId: string, bookingId: string) {
    const clinician = await this.ownDoctor(userId);
    const booking = await this.transition(clinician, bookingId, ['confirmed'], 'completed');
    if (booking.startsAt.getTime() > Date.now()) {
      throw new UnprocessableEntityException('A future session cannot be marked completed before it starts');
    }
    booking.completedAt = new Date();
    await booking.save();
    return {
      success: true,
      data: { appointment: this.presentAppointment(booking), paymentChanged: false },
      meta: this.meta(),
    };
  }

  async markNoShow(userId: string, bookingId: string, reason?: string) {
    const clinician = await this.ownDoctor(userId);
    const booking = await this.transition(clinician, bookingId, ['confirmed'], 'no_show', reason);
    if (booking.startsAt.getTime() > Date.now()) {
      throw new UnprocessableEntityException('A no-show can only be recorded after the session start time');
    }
    booking.noShowAt = new Date();
    await booking.save();
    return { success: true, data: this.presentAppointment(booking), meta: this.meta() };
  }

  /**
   * Moves an appointment to another open slot of the same doctor. The new slot
   * is claimed atomically before the old one is released, so two concurrent
   * reschedules can never both take the same time.
   */
  async rescheduleAppointment(userId: string, bookingId: string, slotId: string, reason?: string) {
    const clinician = await this.ownDoctor(userId);
    if (!Types.ObjectId.isValid(slotId)) throw new BadRequestException('A valid target slot is required');
    const booking = await this.bookingModel.findOne({ _id: new Types.ObjectId(bookingId), clinicianId: clinician._id });
    if (!booking) throw new NotFoundException('Appointment not found');
    if (!OPEN_STATUSES.includes(booking.status)) {
      throw new ConflictException(`This appointment is ${STATUS_LABELS[booking.status] ?? booking.status} and cannot be rescheduled`);
    }

    const now = new Date();
    const target = await this.slotModel.findOneAndUpdate(
      {
        _id: new Types.ObjectId(slotId),
        clinicianId: clinician._id,
        startsAt: { $gt: new Date(now.getTime() + 30 * 60_000) },
        $or: [{ status: 'open' }, { status: 'held', holdExpiresAt: { $lte: now } }],
      },
      { $set: { status: 'booked' }, $unset: { heldBy: 1, holdExpiresAt: 1, holdId: 1 } },
      { new: true },
    ).exec();
    if (!target) throw new ConflictException('That slot is no longer available. Pick another time.');

    const previous = { slotId: booking.slotId, startsAt: booking.startsAt, endsAt: booking.endsAt };
    booking.rescheduledFrom = [...(booking.rescheduledFrom || []), { ...previous, at: now }];
    booking.statusHistory = [
      ...(booking.statusHistory || []),
      {
        from: booking.status,
        to: booking.status,
        actorUserId: clinician.userId,
        actorRole: 'clinician',
        reason: `Rescheduled from ${previous.startsAt.toISOString()}${reason ? `: ${reason}` : ''}`,
        at: now,
      },
    ];
    booking.slotId = target._id;
    booking.startsAt = target.startsAt;
    booking.endsAt = target.endsAt;
    booking.timeZone = this.availability.timeZoneFor(clinician);
    booking.rescheduledAt = now;
    booking.version += 1;
    await booking.save();

    await this.slotModel.updateOne(
      { _id: previous.slotId, status: { $in: ['held', 'booked'] } },
      { $set: { status: 'open' }, $unset: { heldBy: 1, holdExpiresAt: 1, holdId: 1 } },
    );
    await this.notifyPatient(
      booking,
      'APPOINTMENT_RESCHEDULED',
      'Appointment rescheduled',
      `Your appointment moved to ${target.startsAt.toISOString()}.`,
    );
    return { success: true, data: this.presentAppointment(booking), meta: this.meta() };
  }

  // ---------------- dashboard ----------------

  async dashboard(userId: string) {
    const clinician = await this.ownDoctor(userId);
    const timeZone = this.availability.timeZoneFor(clinician);
    const now = new Date();
    const todayKey = localDateKey(now, timeZone);
    const todayStart = new Date(Date.UTC(
      Number(todayKey.slice(0, 4)),
      Number(todayKey.slice(5, 7)) - 1,
      Number(todayKey.slice(8, 10)),
    ));
    // Widen the UTC window by a day on each side, then filter by the doctor's
    // own local date so a Lagos doctor's "today" is exact.
    const windowStart = new Date(todayStart.getTime() - 24 * 60 * 60_000);
    const windowEnd = new Date(todayStart.getTime() + 48 * 60 * 60_000);

    // Every booking view the dashboard needs comes back in one aggregation.
    // The previous version made nine sequential database round-trips, which
    // took ~1.6s against the staging database; this keeps the page snappy while
    // preserving the exact same response contract.
    const [bookingFacets, rules, nextSlot] = await Promise.all([
      this.bookingModel
        .aggregate([
          { $match: { clinicianId: clinician._id } },
          {
            $facet: {
              today: [
                { $match: { startsAt: { $gte: windowStart, $lte: windowEnd } } },
                { $sort: { startsAt: 1 } },
              ],
              pending: [
                { $match: { status: 'pending' } },
                { $sort: { startsAt: 1 } },
                { $limit: 20 },
              ],
              upcoming: [
                {
                  $match: {
                    status: { $in: ['confirmed', 'pending', 'reschedule_requested'] },
                    startsAt: { $gte: now },
                  },
                },
                { $sort: { startsAt: 1 } },
                { $limit: 10 },
              ],
              counts: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
              upcomingCount: [
                {
                  $match: {
                    status: { $in: ['confirmed', 'pending', 'reschedule_requested'] },
                    startsAt: { $gte: now },
                  },
                },
                { $count: 'count' },
              ],
              activity: [
                { $unwind: '$statusHistory' },
                { $sort: { 'statusHistory.at': -1 } },
                { $limit: 8 },
                {
                  $project: {
                    _id: 0,
                    bookingId: '$_id',
                    from: '$statusHistory.from',
                    to: '$statusHistory.to',
                    actorRole: '$statusHistory.actorRole',
                    reason: '$statusHistory.reason',
                    at: '$statusHistory.at',
                  },
                },
              ],
            },
          },
        ])
        .exec(),
      this.availability.rulesFor(clinician._id),
      this.slotModel
        .findOne({ clinicianId: clinician._id, status: 'open', startsAt: { $gt: now } })
        .sort({ startsAt: 1 })
        .lean()
        .exec(),
    ]);

    const facets = (bookingFacets[0] ?? {}) as unknown as {
      today?: any[];
      pending?: any[];
      upcoming?: any[];
      counts?: Array<{ _id: string; count: number }>;
      upcomingCount?: Array<{ count: number }>;
      activity?: any[];
    };
    const todayRows = facets.today ?? [];
    const pendingRows = facets.pending ?? [];
    const upcomingRows = facets.upcoming ?? [];
    const statusCounts = new Map((facets.counts ?? []).map((entry) => [entry._id, entry.count]));
    const completedCount = statusCounts.get('completed') ?? 0;
    const totalCount = Array.from(statusCounts.values()).reduce((sum, value) => sum + value, 0);
    const upcomingTotal = facets.upcomingCount?.[0]?.count ?? upcomingRows.length;
    const activity = facets.activity ?? [];

    const todaysAppointments = todayRows.filter(
      (booking) => localDateKey(booking.startsAt, timeZone) === todayKey,
    );
    const patients = await this.patientSummaries([
      ...todaysAppointments.map((booking) => booking.userId),
      ...pendingRows.map((booking) => booking.userId),
      ...upcomingRows.map((booking) => booking.userId),
    ]);

    return {
      success: true,
      data: {
        doctor: {
          id: clinician._id.toString(),
          displayName: clinician.displayName,
          timeZone,
          accountStatus: this.accountStatus(clinician),
          listed: Boolean(clinician.active && clinician.verificationStatus === 'verified'),
        },
        summary: {
          today: todaysAppointments.filter((booking) => OPEN_STATUSES.includes(booking.status) || booking.status === 'completed').length,
          upcoming: upcomingTotal,
          pending: statusCounts.get('pending') ?? pendingRows.length,
          completed: completedCount,
          total: totalCount,
        },
        today: {
          date: todayKey,
          timeZone,
          appointments: todaysAppointments.map((booking) =>
            this.presentAppointment(booking, patients.get(booking.userId.toString())),
          ),
        },
        pendingRequests: pendingRows.slice(0, 5).map((booking) =>
          this.presentAppointment(booking, patients.get(booking.userId.toString())),
        ),
        upcoming: upcomingRows.slice(0, 5).map((booking) =>
          this.presentAppointment(booking, patients.get(booking.userId.toString())),
        ),
        availability: {
          configuredDays: Array.from(new Set(rules.map((rule) => rule.dayOfWeek))).sort(),
          weeklyGrid: this.availability.weeklyGrid(rules, timeZone, clinician.consultationDurationMinutes),
          nextAvailableAt: nextSlot ? new Date(nextSlot.startsAt).toISOString() : null,
          slotGenerationHorizonDays: SLOT_HORIZON_DAYS,
        },
        recentActivity: activity.map((entry) => ({
          bookingId: entry.bookingId.toString(),
          from: entry.from ?? null,
          to: entry.to,
          actorRole: entry.actorRole,
          reason: entry.reason ?? null,
          at: new Date(entry.at).toISOString(),
        })),
      },
      meta: this.meta(),
    };
  }

  // ---------------- schedule & time off ----------------

  private validateRules(rules: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number; sessionType: string }>) {
    if (rules.length > 50) throw new BadRequestException('A weekly schedule can contain at most 50 periods');
    const byDay = new Map<number, Array<{ startMinutes: number; endMinutes: number }>>();
    for (const rule of rules) {
      if (!Number.isInteger(rule.dayOfWeek) || rule.dayOfWeek < 0 || rule.dayOfWeek > 6) {
        throw new BadRequestException('dayOfWeek must be between 0 (Sunday) and 6 (Saturday)');
      }
      if (rule.endMinutes <= rule.startMinutes) {
        throw new BadRequestException('Each availability period must end after it starts');
      }
      if (rule.endMinutes > 1440) throw new BadRequestException('Availability must end by 24:00');
      const list = byDay.get(rule.dayOfWeek) ?? [];
      for (const existing of list) {
        if (rule.startMinutes < existing.endMinutes && rule.endMinutes > existing.startMinutes) {
          throw new BadRequestException(
            `Availability periods overlap on day ${rule.dayOfWeek}. Merge ${formatMinutes(existing.startMinutes)}–${formatMinutes(existing.endMinutes)} with the new period.`,
          );
        }
      }
      list.push({ startMinutes: rule.startMinutes, endMinutes: rule.endMinutes });
      byDay.set(rule.dayOfWeek, list);
    }
  }

  async getSchedule(userId: string) {
    const clinician = await this.ownDoctor(userId);
    const rules = await this.availability.rulesFor(clinician._id);
    const timeOff = await this.timeOffModel
      .find({ clinicianId: clinician._id, endsAt: { $gt: new Date() } })
      .sort({ startsAt: 1 })
      .limit(100)
      .lean()
      .exec();
    return {
      success: true,
      data: {
        timeZone: this.availability.timeZoneFor(clinician),
        consultationDurationMinutes: clinician.consultationDurationMinutes,
        bufferMinutes: clinician.bufferMinutes,
        bookingApprovalMode: clinician.bookingApprovalMode,
        rules: rules.map((rule) => ({
          id: rule._id.toString(),
          dayOfWeek: rule.dayOfWeek,
          startMinutes: rule.startMinutes,
          endMinutes: rule.endMinutes,
          sessionType: rule.sessionType,
        })),
        weeklyGrid: this.availability.weeklyGrid(rules, this.availability.timeZoneFor(clinician), clinician.consultationDurationMinutes),
        timeOff: timeOff.map((entry) => ({
          id: entry._id.toString(),
          startsAt: new Date(entry.startsAt).toISOString(),
          endsAt: new Date(entry.endsAt).toISOString(),
          reason: entry.reason ?? null,
        })),
        leadTimeMinutes: 30,
        slotGenerationHorizonDays: SLOT_HORIZON_DAYS,
      },
      meta: this.meta(),
    };
  }

  async updateSchedule(
    userId: string,
    input: {
      timeZone: string;
      consultationDurationMinutes: number;
      bufferMinutes: number;
      rules: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number; sessionType: string }>;
    },
  ) {
    const clinician = await this.ownDoctor(userId);
    if (!isValidTimeZone(input.timeZone)) throw new BadRequestException('A valid IANA timezone is required, e.g. Africa/Lagos');
    if (input.consultationDurationMinutes < 10 || input.consultationDurationMinutes > 240) {
      throw new BadRequestException('Consultation duration must be between 10 and 240 minutes');
    }
    if (input.bufferMinutes < 0 || input.bufferMinutes > 120) {
      throw new BadRequestException('Buffer time must be between 0 and 120 minutes');
    }
    this.validateRules(input.rules);

    clinician.timeZone = input.timeZone;
    clinician.consultationDurationMinutes = input.consultationDurationMinutes;
    clinician.bufferMinutes = input.bufferMinutes;
    await clinician.save();

    await this.ruleModel.deleteMany({ clinicianId: clinician._id });
    if (input.rules.length) {
      await this.ruleModel.insertMany(
        input.rules.map((rule) => ({
          clinicianId: clinician._id,
          dayOfWeek: rule.dayOfWeek,
          startMinutes: rule.startMinutes,
          endMinutes: rule.endMinutes,
          sessionType: rule.sessionType,
          active: true,
        })),
      );
    }

    // Future open inventory is rebuilt from the new rules; booked and held
    // slots are preserved.
    await this.availability.clearFutureOpenSlots(clinician._id);
    const from = new Date();
    const to = new Date(from.getTime() + SLOT_HORIZON_DAYS * 24 * 60 * 60_000);
    const generated = await this.availability.generateSlots(clinician, from, to);

    await this.auditModel.create({
      actorUserId: new Types.ObjectId(userId),
      actorRole: 'clinician',
      action: 'UPDATE_DOCTOR_SCHEDULE',
      module: 'care',
      details: `Doctor ${clinician._id} saved ${input.rules.length} weekly periods in ${input.timeZone}; ${generated} slots generated`,
      timestamp: new Date(),
    });

    return {
      success: true,
      data: {
        timeZone: input.timeZone,
        consultationDurationMinutes: input.consultationDurationMinutes,
        bufferMinutes: input.bufferMinutes,
        ruleCount: input.rules.length,
        slotsGenerated: generated,
        weeklyGrid: this.availability.weeklyGrid(input.rules, input.timeZone, input.consultationDurationMinutes),
      },
      meta: this.meta(),
    };
  }

  async previewSchedule(userId: string, days = 14) {
    const clinician = await this.ownDoctor(userId);
    const from = new Date();
    const to = new Date(from.getTime() + Math.min(Math.max(days, 1), 45) * 24 * 60 * 60_000);
    await this.availability.generateSlots(clinician, from, to);
    const slots = await this.slotModel
      .find({ clinicianId: clinician._id, startsAt: { $gte: from, $lte: to }, status: 'open' })
      .sort({ startsAt: 1 })
      .limit(200)
      .lean()
      .exec();
    return {
      success: true,
      data: {
        timeZone: this.availability.timeZoneFor(clinician),
        from: from.toISOString(),
        to: to.toISOString(),
        slots: slots.map((slot) => ({
          id: slot._id.toString(),
          startsAt: new Date(slot.startsAt).toISOString(),
          endsAt: new Date(slot.endsAt).toISOString(),
          sessionType: slot.sessionType,
        })),
      },
      meta: this.meta(),
    };
  }

  async listTimeOff(userId: string) {
    const clinician = await this.ownDoctor(userId);
    const rows = await this.timeOffModel
      .find({ clinicianId: clinician._id, endsAt: { $gt: new Date(Date.now() - 90 * 24 * 60 * 60_000) } })
      .sort({ startsAt: 1 })
      .limit(200)
      .lean()
      .exec();
    return {
      success: true,
      data: {
        timeOff: rows.map((entry) => ({
          id: entry._id.toString(),
          startsAt: new Date(entry.startsAt).toISOString(),
          endsAt: new Date(entry.endsAt).toISOString(),
          reason: entry.reason ?? null,
        })),
      },
      meta: this.meta(),
    };
  }

  /**
   * Blocking time is recorded honestly: existing appointments are returned so
   * the doctor can reschedule or cancel them explicitly. Nothing is cancelled
   * on their behalf.
   */
  async createTimeOff(userId: string, input: { startsAt: string; endsAt: string; reason?: string }) {
    const clinician = await this.ownDoctor(userId);
    const startsAt = new Date(input.startsAt);
    const endsAt = new Date(input.endsAt);
    if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
      throw new BadRequestException('Valid start and end times are required');
    }
    if (endsAt <= startsAt) throw new BadRequestException('The end of a blocked period must follow its start');
    if (endsAt.getTime() - startsAt.getTime() > 60 * 24 * 60 * 60_000) {
      throw new BadRequestException('A single blocked period cannot exceed 60 days');
    }

    const created = await this.timeOffModel.create({
      clinicianId: clinician._id,
      startsAt,
      endsAt,
      reason: input.reason,
      createdByUserId: new Types.ObjectId(userId),
    });

    const affected = await this.availability.overlappingBookings(clinician._id, startsAt, endsAt);
    const patients = await this.patientSummaries(affected.map((booking) => booking.userId as Types.ObjectId));

    // Blocked time also removes unbooked inventory in the range.
    await this.slotModel.deleteMany({
      clinicianId: clinician._id,
      status: 'open',
      startsAt: { $lt: endsAt },
      endsAt: { $gt: startsAt },
    });

    return {
      success: true,
      data: {
        timeOff: {
          id: created._id.toString(),
          startsAt: startsAt.toISOString(),
          endsAt: endsAt.toISOString(),
          reason: created.reason ?? null,
        },
        affectedAppointments: affected.map((booking) => ({
          id: booking._id.toString(),
          startsAt: new Date(booking.startsAt).toISOString(),
          endsAt: new Date(booking.endsAt).toISOString(),
          status: booking.status,
          patient: patients.get(booking.userId.toString()) ?? null,
        })),
        message: affected.length
          ? `${affected.length} existing appointment(s) fall in this blocked period. Reschedule or cancel them explicitly; nothing was changed automatically.`
          : 'Blocked time saved. No existing appointments were affected.',
      },
      meta: this.meta(),
    };
  }

  async deleteTimeOff(userId: string, timeOffId: string) {
    const clinician = await this.ownDoctor(userId);
    if (!Types.ObjectId.isValid(timeOffId)) throw new NotFoundException('Blocked period not found');
    const removed = await this.timeOffModel.findOneAndDelete({ _id: new Types.ObjectId(timeOffId), clinicianId: clinician._id });
    if (!removed) throw new NotFoundException('Blocked period not found');
    const from = new Date();
    const to = new Date(from.getTime() + SLOT_HORIZON_DAYS * 24 * 60 * 60_000);
    await this.availability.generateSlots(clinician, from, to);
    return { success: true, data: { id: timeOffId, deleted: true }, meta: this.meta() };
  }

  // ---------------- notifications ----------------

  async listNotifications(userId: string, query: { cursor?: string; limit: number }) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.notificationModel.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean().exec();
    const hasNext = rows.length > query.limit;
    const items = rows.slice(0, query.limit);
    const unreadCount = await this.notificationModel.countDocuments({ userId: new Types.ObjectId(userId), readAt: { $exists: false } });
    return {
      success: true,
      data: {
        notifications: items.map((item) => ({
          id: item._id.toString(),
          type: item.type,
          title: item.title,
          body: item.body,
          deepLink: item.deepLink ?? null,
          objectId: item.objectId ?? null,
          readAt: item.readAt ? new Date(item.readAt).toISOString() : null,
          createdAt: new Date((item as unknown as { createdAt: Date }).createdAt).toISOString(),
        })),
        unreadCount,
        nextCursor: hasNext ? items[items.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  async markNotificationRead(userId: string, notificationId: string) {
    if (!Types.ObjectId.isValid(notificationId)) throw new NotFoundException('Notification not found');
    const updated = await this.notificationModel.findOneAndUpdate(
      { _id: new Types.ObjectId(notificationId), userId: new Types.ObjectId(userId) },
      { $set: { readAt: new Date() } },
      { new: true },
    );
    if (!updated) throw new NotFoundException('Notification not found');
    return { success: true, data: { id: notificationId, readAt: updated.readAt }, meta: this.meta() };
  }

  /**
   * Records an in-app event and attempts the external channel. Email is a
   * best-effort side effect: a provider outage is reported, never allowed to
   * fail the appointment transaction.
   */
  async notify(
    userId: Types.ObjectId | string,
    input: {
      type: string;
      title: string;
      body: string;
      deepLink?: string;
      objectType?: string;
      objectId?: string;
      dedupeKey?: string;
    },
  ): Promise<{ inApp: true; emailDelivered: boolean }> {
    const recipientId = new Types.ObjectId(userId);
    try {
      await this.notificationModel.create({
        userId: recipientId,
        type: input.type,
        title: input.title,
        body: input.body,
        deepLink: input.deepLink,
        objectType: input.objectType,
        objectId: input.objectId,
        dedupeKey: input.dedupeKey,
      });
    } catch (error) {
      if ((error as { code?: number }).code !== 11000) throw error;
    }

    let emailDelivered = false;
    try {
      const user = await this.userModel.findById(recipientId).select('email status').lean().exec();
      if (user?.email) {
        emailDelivered = await this.mail.trySend('appointment-notification', () =>
          this.mail.sendAppointmentEmail(user.email as string, input.title, input.body, input.deepLink),
        );
      }
    } catch {
      emailDelivered = false;
    }
    return { inApp: true, emailDelivered };
  }

  /** Doctor-facing event for a booking that just reached their queue. */
  async notifyDoctorNewBooking(booking: BookingDocument) {
    const clinician = await this.clinicianModel.findById(booking.clinicianId).select('userId').lean().exec();
    if (!clinician?.userId) return;
    const awaiting = booking.status === 'pending' ? 'needs your confirmation' : 'is now confirmed';
    await this.notify(clinician.userId, {
      type: 'APPOINTMENT_NEW',
      title: 'New appointment',
      body: `A ${booking.sessionType} appointment on ${booking.startsAt.toISOString()} ${awaiting}.`,
      deepLink: `/doctor/appointments/${booking._id.toString()}`,
      objectType: 'booking',
      objectId: booking._id.toString(),
      dedupeKey: `new-booking-${booking._id.toString()}`,
    });
  }

  private async notifyPatient(booking: BookingDocument, type: string, title: string, body: string) {
    await this.notify(booking.userId, {
      type,
      title,
      body,
      deepLink: `/appointments/${booking._id.toString()}`,
      objectType: 'booking',
      objectId: booking._id.toString(),
      dedupeKey: `${type.toLowerCase()}-${booking._id.toString()}-${booking.version}`,
    });
  }
}
