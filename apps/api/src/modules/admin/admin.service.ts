import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { User, UserDocument, UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { Pregnancy, PregnancyDocument } from '../../database/schemas/pregnancy.schema';
import { DirectoryService, DirectoryServiceDocument } from '../../database/schemas/directory.schema';
import { Booking, Clinician, ClinicianDocument, Payment, PaymentDocument } from '../../database/schemas/care.schema';
import { Consultation, ConsultationDocument } from '../../database/schemas/communications.schema';
import { SafetyIncident, SafetyIncidentDocument } from '../../database/schemas/safety.schema';
import { SupportTicket, SupportTicketDocument } from '../../database/schemas/support.schema';
import { AuthService } from '../auth/auth.service';
import { MailService } from '../mail/mail.service';
import { env } from '../../config/env.validation';
import { shouldExposeDevTokens } from '../../common/auth/token-exposure';
import { addDaysToDateKey, localDateKey, isValidTimeZone, zonedWallClockToUtc } from '../../common/time/zoned-time';
import { COUNTRY_CONFIGURATIONS } from '@obiren/localization';

const ADMIN_ROLES = ['super_admin', 'platform_admin'];

export function requireAdminRole(user: any, allowed: string[]): void {
  if (!user || !Array.isArray(user.roles) || !user.roles.some((r: string) => allowed.includes(r))) {
    throw new ForbiddenException('Access denied: insufficient administrative role');
  }
}

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Pregnancy.name) private pregnancyModel: Model<PregnancyDocument>,
    @InjectModel(DirectoryService.name) private directoryModel: Model<DirectoryServiceDocument>,
    @InjectModel(Clinician.name) private clinicianModel: Model<ClinicianDocument>,
    @InjectModel(Consultation.name) private consultationModel: Model<ConsultationDocument>,
    @InjectModel(UserProfile.name) private profileModel: Model<UserProfileDocument>,
    @InjectModel(Booking.name) private bookingModel: Model<Booking>,
    @InjectModel(Payment.name) private paymentModel: Model<PaymentDocument>,
    @InjectModel(SafetyIncident.name) private safetyIncidentModel: Model<SafetyIncidentDocument>,
    @InjectModel(SupportTicket.name) private supportTicketModel: Model<SupportTicketDocument>,
    private readonly authService: AuthService,
    private readonly mail: MailService,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  async getMetrics(adminUser: any) {
    requireAdminRole(adminUser, ADMIN_ROLES);

    const now = new Date();
    // The platform's primary operating market. Each appointment still carries
    // its own doctor timezone; this only scopes the shared "today" counter.
    const operationsTimeZone = 'Africa/Lagos';
    const todayKey = localDateKey(now, operationsTimeZone);
    const dayStart = zonedWallClockToUtc(todayKey, 0, operationsTimeZone);
    const dayEnd = zonedWallClockToUtc(addDaysToDateKey(todayKey, 1), 0, operationsTimeZone);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86_400_000);

    const [
      totalUsers,
      newUsersLast7Days,
      activePregnancies,
      verifiedEmergencyResources,
      totalDoctors,
      verifiedDoctors,
      activeDoctors,
      appointmentsToday,
      pendingAppointments,
      confirmedUpcoming,
      openSupportTickets,
      activeSosIncidents,
      paymentTotalsAgg,
      countryAgg,
    ] = await Promise.all([
      this.userModel.countDocuments(),
      this.userModel.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
      this.pregnancyModel.countDocuments({ status: 'active' }),
      this.directoryModel.countDocuments({ verification_status: 'Source verified' }),
      this.clinicianModel.countDocuments(),
      this.clinicianModel.countDocuments({ verificationStatus: 'verified' }),
      this.clinicianModel.countDocuments({ verificationStatus: 'verified', active: true }),
      this.bookingModel.countDocuments({
        startsAt: { $gte: dayStart, $lt: dayEnd },
        status: { $in: ['pending', 'confirmed', 'reschedule_requested', 'completed'] },
      }),
      this.bookingModel.countDocuments({ status: 'pending' }),
      this.bookingModel.countDocuments({ status: 'confirmed', startsAt: { $gte: now } }),
      this.supportTicketModel.countDocuments({ status: { $in: ['open', 'in_progress'] } }),
      this.safetyIncidentModel.countDocuments({ status: { $in: ['active', 'triggered'] } }),
      this.paymentModel.aggregate([
        { $match: { status: 'succeeded' } },
        { $group: { _id: '$currency', amountMinor: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
      ]),
      this.userModel.aggregate([{ $group: { _id: '$countryCode', count: { $sum: 1 } } }]),
    ]);

    const countryBreakdown: Record<string, any> = {};
    countryAgg.forEach((c) => {
      countryBreakdown[c._id || 'unknown'] = { users: c.count };
    });

    return {
      success: true,
      data: {
        totalUsers,
        newUsersLast7Days,
        activePregnancies,
        verifiedEmergencyResources,
        totalDoctors,
        verifiedDoctors,
        activeDoctors,
        appointmentsToday,
        pendingAppointments,
        confirmedUpcoming,
        openSupportTickets,
        activeSosIncidents,
        payments: {
          byCurrency: paymentTotalsAgg.map((row) => ({
            currency: row._id,
            amountMinor: row.amountMinor,
            count: row.count,
          })),
          policyPending: !env().paymentEnabled,
        },
        operationsTimeZone,
        today: todayKey,
        generatedAt: now.toISOString(),
        countryBreakdown,
      },
      meta: this.meta(),
    };
  }

  /** Escapes user input before it is used inside a MongoDB regex. */
  private regexFor(value: string): RegExp {
    return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
  }

  /**
   * Cross-platform appointment register. Returns only what staff need to
   * operate the booking queue: identity, schedule, status, payment state and
   * the doctor. Clinical notes and health records are never joined in.
   */
  async listAppointments(adminUser: any, query: { status?: string; from?: string; to?: string; q?: string; page: number; limit: number }) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const skip = (query.page - 1) * query.limit;

    const earlyMatch: Record<string, unknown> = {};
    if (query.status) earlyMatch.status = { $in: query.status.split(',') };
    if (query.from || query.to) {
      earlyMatch.startsAt = {
        ...(query.from ? { $gte: new Date(query.from) } : {}),
        ...(query.to ? { $lte: new Date(query.to) } : {}),
      };
    }

    const pipeline: any[] = [];
    if (Object.keys(earlyMatch).length) pipeline.push({ $match: earlyMatch });
    pipeline.push(
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'patient' } },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'user_profiles', localField: 'userId', foreignField: 'userId', as: 'patientProfile' } },
      { $unwind: { path: '$patientProfile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'clinicians', localField: 'clinicianId', foreignField: '_id', as: 'doctor' } },
      { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'payments',
          localField: '_id',
          foreignField: 'bookingId',
          as: 'payments',
          pipeline: [{ $sort: { createdAt: -1 } }, { $limit: 1 }],
        },
      },
      { $addFields: { latestPayment: { $first: '$payments' } } },
    );

    if (query.q) {
      const regex = this.regexFor(query.q);
      pipeline.push({
        $match: {
          $or: [
            { reference: regex },
            { 'patient.email': regex },
            { 'patientProfile.displayName': regex },
            { 'doctor.displayName': regex },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { startsAt: -1, _id: -1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: query.limit },
            {
              $project: {
                _id: 0,
                id: { $toString: '$_id' },
                reference: { $ifNull: ['$reference', { $toString: '$_id' }] },
                status: 1,
                sessionType: 1,
                startsAt: 1,
                endsAt: 1,
                timeZone: 1,
                amountMinor: 1,
                currency: 1,
                refundStatus: 1,
                cancellationReason: 1,
                rejectionReason: 1,
                createdAt: 1,
                patient: {
                  displayName: { $ifNull: ['$patientProfile.displayName', { $ifNull: ['$patient.email', 'Unknown patient'] }] },
                  email: { $ifNull: ['$patient.email', null] },
                  phoneNumber: { $ifNull: ['$patientProfile.phoneNumber', null] },
                },
                doctor: {
                  id: { $toString: '$doctor._id' },
                  displayName: { $ifNull: ['$doctor.displayName', 'Unassigned doctor'] },
                },
                paymentStatus: { $ifNull: ['$latestPayment.status', null] },
              },
            },
          ],
          total: [{ $count: 'count' }],
          statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
    );

    const facets = await this.bookingModel.aggregate(pipeline).exec();
    const result = (facets[0] ?? {}) as any;
    const statusCounts: Record<string, number> = {};
    for (const entry of result.statuses ?? []) statusCounts[entry._id] = entry.count;

    return {
      success: true,
      data: {
        appointments: result?.rows ?? [],
        total: result?.total?.[0]?.count ?? 0,
        page: query.page,
        limit: query.limit,
        statusCounts,
      },
      meta: this.meta(),
    };
  }

  /** Payment register for finance and operations. No card or gateway secret is returned. */
  async listPayments(adminUser: any, query: { status?: string; q?: string; page: number; limit: number }) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const skip = (query.page - 1) * query.limit;
    const pipeline: any[] = [
      { $lookup: { from: 'bookings', localField: 'bookingId', foreignField: '_id', as: 'booking' } },
      { $unwind: { path: '$booking', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'patient' } },
      { $unwind: { path: '$patient', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'user_profiles', localField: 'userId', foreignField: 'userId', as: 'patientProfile' } },
      { $unwind: { path: '$patientProfile', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'clinicians', localField: 'booking.clinicianId', foreignField: '_id', as: 'doctor' } },
      { $unwind: { path: '$doctor', preserveNullAndEmptyArrays: true } },
    ];

    const match: Record<string, unknown> = {};
    if (query.status) match.status = query.status;
    if (query.q) {
      const regex = this.regexFor(query.q);
      match.$or = [{ reference: regex }, { 'patient.email': regex }, { 'doctor.displayName': regex }];
    }
    if (Object.keys(match).length) pipeline.push({ $match: match });

    pipeline.push(
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          rows: [
            { $skip: skip },
            { $limit: query.limit },
            {
              $project: {
                _id: 0,
                id: { $toString: '$_id' },
                reference: 1,
                gateway: 1,
                amountMinor: 1,
                currency: 1,
                status: 1,
                failureReason: 1,
                verifiedAt: 1,
                createdAt: 1,
                bookingId: { $toString: '$booking._id' },
                bookingStatus: { $ifNull: ['$booking.status', null] },
                patient: {
                  displayName: { $ifNull: ['$patientProfile.displayName', { $ifNull: ['$patient.email', 'Unknown patient'] }] },
                  email: { $ifNull: ['$patient.email', null] },
                },
                doctor: {
                  id: { $toString: '$doctor._id' },
                  displayName: { $ifNull: ['$doctor.displayName', 'Unassigned doctor'] },
                },
              },
            },
          ],
          total: [{ $count: 'count' }],
          statuses: [{ $group: { _id: '$status', count: { $sum: 1 } } }],
        },
      },
    );

    const [facets, totals] = await Promise.all([
      this.paymentModel.aggregate(pipeline).exec(),
      this.paymentModel
        .aggregate([
          { $match: { status: 'succeeded' } },
          { $group: { _id: '$currency', amountMinor: { $sum: '$amountMinor' }, count: { $sum: 1 } } },
          { $sort: { _id: 1 } },
        ])
        .exec(),
    ]);
    const result = (facets[0] ?? {}) as any;
    const statusCounts: Record<string, number> = {};
    for (const entry of result.statuses ?? []) statusCounts[entry._id] = entry.count;

    return {
      success: true,
      data: {
        payments: result.rows ?? [],
        total: result.total?.[0]?.count ?? 0,
        page: query.page,
        limit: query.limit,
        statusCounts,
        totals: totals.map((row) => ({ currency: row._id, amountMinor: row.amountMinor, count: row.count })),
        policyPending: !env().paymentEnabled,
      },
      meta: this.meta(),
    };
  }

  /**
   * SOS operations register. Deliberately omits exact GPS coordinates and free
   * text. Staff see incident state and delivery counts, not a health record.
   */
  async listSafetyIncidents(adminUser: any, query: { status?: string; limit: number }) {
    requireAdminRole(adminUser, ['super_admin', 'platform_admin', 'emergency_manager', 'compliance_officer']);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;

    const [incidents, total] = await Promise.all([
      this.safetyIncidentModel
        .find(filter)
        .sort({ triggeredAt: -1, createdAt: -1 })
        .limit(query.limit)
        .select('userId status dispatchStatus isTestMode triggeredAt cancelledAt trustedContactIds createdAt')
        .lean()
        .exec(),
      this.safetyIncidentModel.countDocuments(filter),
    ]);

    const userIds = incidents.map((incident) => incident.userId);
    const incidentIds = incidents.map((incident) => incident._id);
    const [users, profiles, deliveryRows] = await Promise.all([
      this.userModel.find({ _id: { $in: userIds } }).select('email countryCode').lean().exec(),
      this.profileModel.find({ userId: { $in: userIds } }).select('displayName').lean().exec(),
      this.safetyIncidentModel.db
        .collection('safety_delivery_attempts')
        .aggregate([
          { $match: { incidentId: { $in: incidentIds } } },
          { $group: { _id: { incidentId: '$incidentId', status: '$status' }, count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const userMap = new Map(users.map((user) => [String(user._id), user]));
    const profileMap = new Map(profiles.map((profile) => [String(profile.userId), profile]));
    const deliveryMap = new Map<string, Record<string, number>>();
    for (const row of deliveryRows) {
      const incidentId = String(row._id.incidentId);
      const counts = deliveryMap.get(incidentId) ?? {};
      counts[row._id.status] = row.count;
      deliveryMap.set(incidentId, counts);
    }

    return {
      success: true,
      data: {
        incidents: incidents.map((incident) => {
          const user = userMap.get(String(incident.userId));
          const profile = profileMap.get(String(incident.userId));
          const delivery = deliveryMap.get(String(incident._id)) ?? {};
          return {
            id: String(incident._id),
            status: incident.status,
            dispatchStatus: incident.dispatchStatus,
            isTestMode: Boolean(incident.isTestMode),
            triggeredAt: incident.triggeredAt,
            cancelledAt: incident.cancelledAt ?? null,
            createdAt: (incident as unknown as { createdAt?: Date }).createdAt ?? null,
            trustedContactCount: (incident.trustedContactIds || []).length,
            patient: {
              displayName: profile?.displayName ?? user?.email ?? 'Unknown account',
              email: user?.email ?? null,
              countryCode: user?.countryCode ?? null,
            },
            delivery: {
              sent: delivery.sent ?? 0,
              failed: delivery.failed ?? 0,
              skipped: delivery.skipped ?? 0,
              simulated: delivery.simulated ?? 0,
            },
          };
        }),
        total,
      },
      meta: this.meta(),
    };
  }

  /** Read-only runtime readiness. Secrets are never included. */
  async getPlatformStatus(adminUser: any) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const config = env();
    return {
      success: true,
      data: {
        environment: config.nodeEnv,
        degraded: config.degraded,
        generatedAt: new Date().toISOString(),
        countries: Object.values(COUNTRY_CONFIGURATIONS).map((country) => ({
          code: country.code,
          name: country.name,
          flag: country.flag,
          currency: country.currency.code,
          features: country.features,
        })),
        payments: {
          enabled: config.paymentEnabled,
          policyVersion: config.paymentPolicyVersion ?? null,
          gatewayConfigured: Boolean(config.paystack.secretKey),
          currency: config.paystack.currency,
        },
        email: {
          delivery: config.email.resendApiKey ? 'configured' : 'mock',
          from: config.email.fromEmail,
        },
        whatsapp: {
          delivery: config.twilio.accountSid && config.twilio.authToken ? 'configured' : 'not_configured',
        },
        googleSignIn: { enabled: config.google.clientIds.length > 0 },
        redis: { configured: Boolean(config.redisUrl) },
      },
      meta: this.meta(),
    };
  }

  async listUsers(adminUser: any, page = 1, limit = 20) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.userModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).select('email status roles countryCode createdAt lastLoginAt').exec(),
      this.userModel.countDocuments(),
    ]);
    return { success: true, data: { users, total, page, limit }, meta: this.meta() };
  }

  async setUserStatus(adminUser: any, userId: string, status: string) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');
    // Staff must never lock themselves out of the console they are using.
    if (String(adminUser.sub) === String(user._id)) {
      throw new BadRequestException('You cannot change the status of your own account.');
    }
    if (user.roles.includes('super_admin') && !adminUser.roles.includes('super_admin')) {
      throw new ForbiddenException('Only a super admin can modify another super admin.');
    }
    // The platform must always keep at least one usable super admin.
    if (user.roles.includes('super_admin') && status !== 'active') {
      const remaining = await this.userModel.countDocuments({
        _id: { $ne: user._id },
        roles: 'super_admin',
        status: 'active',
      });
      if (remaining === 0) {
        throw new BadRequestException('At least one active super admin must remain.');
      }
    }
    user.status = status;
    await user.save();
    await this.logAdminAction(adminUser.sub, adminUser.roles?.[0] || 'unknown', 'SET_USER_STATUS', 'users', `Set ${user.email} to ${status}`);
    return { success: true, data: { id: user._id, email: user.email, status: user.status }, meta: this.meta() };
  }

  async upsertDirectoryRecord(adminUser: any, dto: any) {
    requireAdminRole(adminUser, ['super_admin', 'platform_admin', 'emergency_manager']);
    const existing = await this.directoryModel.findOne({ record_id: dto.record_id });
    if (existing) {
      Object.assign(existing, dto);
      await existing.save();
      return { success: true, data: existing, meta: this.meta() };
    }
    const created = await this.directoryModel.create(dto);
    await this.logAdminAction(adminUser.sub, adminUser.roles?.[0] || 'unknown', 'UPSERT_DIRECTORY', 'directory', dto.record_id);
    return { success: true, data: created, meta: this.meta() };
  }

  async listClinicians(adminUser: any, query: { verificationStatus?: string; page: number; limit: number }) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const filter: Record<string, unknown> = {};
    if (query.verificationStatus) filter.verificationStatus = query.verificationStatus;
    const skip = (query.page - 1) * query.limit;
    const [clinicians, total] = await Promise.all([
      this.clinicianModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(query.limit)
        .select('userId displayName specialties languages countryCode verificationStatus verificationEvidenceRef verificationNote reviewedAt reviewedBy active')
        .lean()
        .exec(),
      this.clinicianModel.countDocuments(filter),
    ]);
    return { success: true, data: { clinicians, total, page: query.page, limit: query.limit }, meta: this.meta() };
  }

  /**
   * Verification is an audited administrative decision. A clinician is never
   * verified without a stored evidence reference, and only verified + active
   * clinicians appear in the user catalog.
   */
  async verifyClinician(adminUser: any, clinicianId: string, dto: { verificationStatus: string; evidenceRef?: string; note?: string; active?: boolean }) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const clinician = await this.clinicianModel.findById(clinicianId);
    if (!clinician) throw new NotFoundException('Clinician profile not found');
    if (dto.verificationStatus === 'verified' && !dto.evidenceRef && !clinician.verificationEvidenceRef) {
      throw new BadRequestException('An evidence reference is required before a clinician can be verified');
    }
    const targetUser = await this.userModel.findById(clinician.userId).select('roles status').lean().exec();
    if (!targetUser) throw new UnprocessableEntityException('The clinician account no longer exists');
    if (dto.verificationStatus === 'verified' && !targetUser.roles?.includes('clinician')) {
      throw new UnprocessableEntityException('The linked account does not hold the clinician role');
    }
    clinician.verificationStatus = dto.verificationStatus;
    if (dto.evidenceRef) clinician.verificationEvidenceRef = dto.evidenceRef;
    if (dto.note !== undefined) clinician.verificationNote = dto.note;
    clinician.active = dto.active ?? dto.verificationStatus === 'verified';
    clinician.reviewedAt = new Date();
    clinician.reviewedBy = new Types.ObjectId(adminUser.sub);
    await clinician.save();
    await this.logAdminAction(
      adminUser.sub,
      adminUser.roles?.[0] || 'unknown',
      'VERIFY_CLINICIAN',
      'care',
      `Set clinician ${clinician._id} to ${clinician.verificationStatus} (active=${clinician.active})`,
    );
    return { success: true, data: clinician, meta: this.meta() };
  }

  /**
   * A consultation is an administrative care-relationship record. It does not
   * confirm a booking, payment, or appointment; messaging is membership-scoped.
   */
  async createConsultation(adminUser: any, dto: { patientUserId: string; clinicianId: string }) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const clinician = await this.clinicianModel.findOne({ _id: dto.clinicianId, verificationStatus: 'verified', active: true }).lean().exec();
    if (!clinician) throw new NotFoundException('An active, verified clinician is required');
    const patient = await this.userModel.findById(dto.patientUserId).select('status').lean().exec();
    if (!patient || ['suspended', 'restricted', 'deleted'].includes(patient.status)) {
      throw new NotFoundException('Usable patient account not found');
    }
    if (clinician.userId.toString() === dto.patientUserId) throw new BadRequestException('A patient cannot be their own clinician');
    const existing = await this.consultationModel.findOne({
      clinicianId: clinician._id,
      patientUserId: new Types.ObjectId(dto.patientUserId),
      status: 'open',
    }).lean().exec();
    if (existing) throw new ConflictException('An open consultation already exists for this patient and clinician');
    const consultation = await this.consultationModel.create({
      patientUserId: new Types.ObjectId(dto.patientUserId),
      clinicianUserId: clinician.userId,
      clinicianId: clinician._id,
      participantUserIds: [new Types.ObjectId(dto.patientUserId), clinician.userId],
      status: 'open',
      lastMessageAt: new Date(),
    });
    await this.logAdminAction(adminUser.sub, adminUser.roles?.[0] || 'unknown', 'CREATE_CONSULTATION', 'care', `Created consultation ${consultation._id}`);
    return {
      success: true,
      data: { id: consultation._id.toString(), status: consultation.status, participantCount: consultation.participantUserIds.length, bookingConfirmed: false, message: 'Care relationship recorded; no booking or payment was confirmed.' },
      meta: this.meta(),
    };
  }

  // ---------------- doctor management (PRD Add Doctor) ----------------

  private defaultTimeZone(countryCode: string): string {
    return countryCode === 'GB'
      ? 'Europe/London'
      : countryCode === 'US'
        ? 'America/New_York'
        : countryCode === 'GH'
          ? 'Africa/Accra'
          : 'Africa/Lagos';
  }

  private splitName(fullName: string): { firstName: string; lastName: string } {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
  }

  private doctorStatus(clinician: any, userStatus?: string): 'invited' | 'active' | 'inactive' | 'suspended' {
    if (userStatus === 'suspended') return 'suspended';
    if (userStatus === 'pending_verification') return 'invited';
    if (clinician.active && clinician.verificationStatus === 'verified') return 'active';
    return 'inactive';
  }

  private presentDoctor(row: any) {
    const user = row.user || {};
    const listed = Boolean(row.active && row.verificationStatus === 'verified' && user.status === 'active');
    return {
      id: row._id.toString(),
      userId: row.userId ? row.userId.toString() : null,
      displayName: row.displayName,
      email: user.email ?? null,
      phoneNumber: row.phoneNumber ?? null,
      photoUrl: row.photoUrl ?? null,
      specialization: (row.specialties || [])[0] ?? null,
      specialties: row.specialties || [],
      professionalTitle: row.professionalTitle ?? row.profession ?? null,
      licenceNumber: row.licenceNumber ?? null,
      languages: row.languages || [],
      countryCode: row.countryCode,
      status: this.doctorStatus(row, user.status),
      accountStatus: user.status ?? null,
      listed,
      verificationStatus: row.verificationStatus,
      bookingApprovalMode: row.bookingApprovalMode ?? 'instant',
      bookingCount: row.bookingCount ?? 0,
      createdAt: row.createdAt ? new Date(row.createdAt).toISOString() : null,
      lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt).toISOString() : null,
      suspensionReason: row.suspensionReason ?? null,
    };
  }

  async listDoctors(adminUser: any, query: { q?: string; status?: string; listed?: string; specialization?: string; page: number; limit: number }) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const skip = (query.page - 1) * query.limit;

    const pipeline: any[] = [
      { $lookup: { from: 'users', localField: 'userId', foreignField: '_id', as: 'user' } },
      { $unwind: { path: '$user', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          computedStatus: {
            $cond: [
              { $eq: ['$user.status', 'suspended'] },
              'suspended',
              {
                $cond: [
                  { $eq: ['$user.status', 'pending_verification'] },
                  'invited',
                  {
                    $cond: [
                      { $and: [{ $eq: ['$active', true] }, { $eq: ['$verificationStatus', 'verified'] }] },
                      'active',
                      'inactive',
                    ],
                  },
                ],
              },
            ],
          },
        },
      },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: 'clinicianId',
          as: 'bookings',
          pipeline: [{ $count: 'count' }],
        },
      },
      { $addFields: { bookingCount: { $ifNull: [{ $first: '$bookings.count' }, 0] } } },
    ];

    const match: Record<string, unknown> = {};
    if (query.status) match.computedStatus = query.status;
    if (query.listed === 'true') { match.active = true; match.verificationStatus = 'verified'; }
    if (query.listed === 'false') match.$or = [{ active: false }, { verificationStatus: { $ne: 'verified' } }];
    if (query.specialization) match.specialties = query.specialization;
    if (query.q) {
      const escaped = query.q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      match.$and = [
        {
          $or: [
            { displayName: { $regex: escaped, $options: 'i' } },
            { 'user.emailNormalized': { $regex: escaped.toLowerCase(), $options: 'i' } },
            { licenceNumber: { $regex: escaped, $options: 'i' } },
          ],
        },
      ];
    }
    if (Object.keys(match).length) pipeline.push({ $match: match });

    pipeline.push({ $sort: { createdAt: -1 } });
    pipeline.push({
      $facet: {
        rows: [{ $skip: skip }, { $limit: query.limit }],
        total: [{ $count: 'count' }],
        statuses: [{ $group: { _id: '$computedStatus', count: { $sum: 1 } } }],
      },
    });

    const [result] = await this.clinicianModel.aggregate(pipeline);
    const statusCounts: Record<string, number> = { invited: 0, active: 0, inactive: 0, suspended: 0 };
    for (const entry of result?.statuses ?? []) statusCounts[entry._id] = entry.count;

    return {
      success: true,
      data: {
        doctors: (result?.rows ?? []).map((row: any) => this.presentDoctor(row)),
        total: result?.total?.[0]?.count ?? 0,
        page: query.page,
        limit: query.limit,
        statusCounts,
      },
      meta: this.meta(),
    };
  }

  async getDoctor(adminUser: any, clinicianId: string) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const clinician = await this.clinicianModel.findById(clinicianId).lean().exec();
    if (!clinician) throw new NotFoundException('Doctor not found');
    const [user, profile, bookingCount] = await Promise.all([
      this.userModel.findById(clinician.userId).select('email status emailVerifiedAt lastLoginAt createdAt').lean().exec(),
      this.profileModel.findOne({ userId: clinician.userId }).select('firstName lastName displayName phoneNumber').lean().exec(),
      this.bookingModel.countDocuments({ clinicianId: clinician._id }),
    ]);
    return {
      success: true,
      data: {
        ...this.presentDoctor({ ...clinician, user: { ...user, emailNormalized: user?.email }, bookingCount }),
        firstName: profile?.firstName ?? null,
        lastName: profile?.lastName ?? null,
        registrationInvitedAt: (user as unknown as { createdAt?: Date } | null)?.createdAt ?? null,
        emailVerified: Boolean(user?.emailVerifiedAt),
        timeZone: clinician.timeZone ?? this.defaultTimeZone(clinician.countryCode),
        consultationDurationMinutes: clinician.consultationDurationMinutes,
        clinicName: clinician.clinicName ?? null,
        clinicAddress: clinician.clinicAddress ?? null,
        bio: clinician.bio ?? null,
        yearsOfExperience: clinician.yearsOfExperience ?? null,
        certifications: clinician.certifications || [],
        feeBySessionType: clinician.feeBySessionType || {},
        credentialReviewRequired: Boolean(clinician.credentialReviewRequired),
        adminNote: clinician.adminNote ?? null,
      },
      meta: this.meta(),
    };
  }

  /**
   * Creates a doctor account and profile, then sends a single-use activation
   * link. No administrator can set or read a doctor password; in development
   * without an email provider the one-time token is surfaced exactly once and
   * the delivery limitation is reported honestly.
   */
  async createDoctor(adminUser: any, dto: any) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    if (dto.listed && dto.verificationStatus !== 'verified') {
      throw new UnprocessableEntityException('Only a verified doctor can be listed publicly');
    }
    const emailNormalized = String(dto.email).toLowerCase();
    const existingUser = await this.userModel.findOne({ emailNormalized }).select('_id').lean().exec();
    if (existingUser) throw new ConflictException('An account with this email already exists');
    if (dto.licenceNumber) {
      const duplicate = await this.clinicianModel.findOne({ licenceNumber: dto.licenceNumber }).lean().exec();
      if (duplicate) throw new ConflictException('That licence number is already registered to another doctor');
    }

    const { firstName, lastName } = this.splitName(dto.fullName);
    const timeZone = dto.timeZone && isValidTimeZone(dto.timeZone) ? dto.timeZone : this.defaultTimeZone(dto.countryCode);

    const user = await this.userModel.create({
      email: dto.email,
      emailNormalized,
      status: 'pending_verification',
      roles: ['user', 'clinician'],
      countryCode: dto.countryCode,
      timeZone,
      authProviders: ['password'],
    });
    await this.profileModel.create({
      userId: user._id,
      firstName,
      lastName,
      displayName: dto.fullName,
      phoneNumber: dto.phoneNumber,
      countryCode: dto.countryCode,
      timeZone,
    });

    const feeBySessionType: Record<string, number> = {};
    if (Number(dto.consultationFeeMinor) > 0) {
      for (const type of dto.consultationTypes) feeBySessionType[type] = dto.consultationFeeMinor;
    }
    const verified = dto.verificationStatus === 'verified';

    const clinician = await this.clinicianModel.create({
      userId: user._id,
      displayName: dto.fullName,
      professionalTitle: dto.professionalTitle,
      profession: dto.specialization,
      specialties: [dto.specialization],
      languages: dto.languages,
      countryCode: dto.countryCode,
      timeZone,
      certifications: dto.qualifications || [],
      licenceNumber: dto.licenceNumber,
      yearsOfExperience: dto.yearsOfExperience,
      bio: dto.biography,
      clinicName: dto.clinicName,
      clinicAddress: dto.clinicAddress,
      phoneNumber: dto.phoneNumber,
      photoUrl: dto.photoUrl,
      consultationDurationMinutes: dto.consultationDurationMinutes,
      bookingApprovalMode: dto.bookingApprovalMode,
      feeBySessionType,
      verificationStatus: dto.verificationStatus,
      verificationEvidenceRef: verified && dto.licenceNumber ? `licence:${dto.licenceNumber}` : undefined,
      reviewedAt: verified ? new Date() : undefined,
      reviewedBy: verified ? new Types.ObjectId(adminUser.sub) : undefined,
      // Public listing begins only after the doctor activates their own account.
      active: false,
      createdByUserId: new Types.ObjectId(adminUser.sub),
    });

    const token = await this.authService.issueDoctorInvitation(user);
    const emailDelivered = await this.mail.trySend('doctor-invitation', () =>
      this.mail.sendDoctorInvitationEmail(user.email, token, dto.fullName),
    );

    await this.logAdminAction(
      adminUser.sub,
      adminUser.roles?.[0] || 'unknown',
      'CREATE_DOCTOR',
      'care',
      `Created doctor ${clinician._id} (${emailNormalized}), listed=${clinician.active}`,
    );

    return {
      success: true,
      data: {
        doctor: await this.getDoctor(adminUser, clinician._id.toString()).then((result) => result.data),
        invitation: {
          emailDelivered,
          emailDelivery: emailDelivered ? 'sent' : 'not_configured',
          activationRequired: true,
          expiresInDays: 7,
          // One-time, expiring, and only surfaced in non-production when no
          // email provider is configured. Never a reusable password.
          ...(!emailDelivered && shouldExposeDevTokens(env().nodeEnv) ? { activationToken: token } : {}),
          message: emailDelivered
            ? 'Invitation email sent. The doctor sets their own password.'
            : 'Email delivery is not configured. Share the single-use activation link through a secure channel; it expires in 7 days.',
        },
      },
      meta: this.meta(),
    };
  }

  async updateDoctor(adminUser: any, clinicianId: string, dto: any) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const clinician = await this.clinicianModel.findById(clinicianId);
    if (!clinician) throw new NotFoundException('Doctor not found');

    if (dto.licenceNumber && dto.licenceNumber !== clinician.licenceNumber) {
      const duplicate = await this.clinicianModel.findOne({ licenceNumber: dto.licenceNumber, _id: { $ne: clinician._id } }).lean().exec();
      if (duplicate) throw new ConflictException('That licence number is already registered to another doctor');
      clinician.licenceNumber = dto.licenceNumber;
    }
    if (dto.fullName) {
      clinician.displayName = dto.fullName;
      const { firstName, lastName } = this.splitName(dto.fullName);
      await this.profileModel.updateOne({ userId: clinician.userId }, { $set: { displayName: dto.fullName, firstName, lastName } });
    }
    if (dto.phoneNumber !== undefined) {
      clinician.phoneNumber = dto.phoneNumber;
      await this.profileModel.updateOne({ userId: clinician.userId }, { $set: { phoneNumber: dto.phoneNumber } });
    }
    if (dto.photoUrl !== undefined) clinician.photoUrl = dto.photoUrl;
    if (dto.professionalTitle) clinician.professionalTitle = dto.professionalTitle;
    if (dto.specialization) {
      clinician.profession = dto.specialization;
      clinician.specialties = [dto.specialization];
    }
    if (dto.qualifications) clinician.certifications = dto.qualifications;
    if (dto.yearsOfExperience !== undefined) clinician.yearsOfExperience = dto.yearsOfExperience;
    if (dto.biography !== undefined) clinician.bio = dto.biography;
    if (dto.languages) clinician.languages = dto.languages;
    if (dto.clinicName !== undefined) clinician.clinicName = dto.clinicName;
    if (dto.clinicAddress !== undefined) clinician.clinicAddress = dto.clinicAddress;
    if (dto.countryCode) clinician.countryCode = dto.countryCode;
    if (dto.timeZone) {
      if (!isValidTimeZone(dto.timeZone)) throw new BadRequestException('A valid IANA timezone is required');
      clinician.timeZone = dto.timeZone;
    }
    if (dto.consultationDurationMinutes !== undefined) clinician.consultationDurationMinutes = dto.consultationDurationMinutes;
    if (dto.bookingApprovalMode) clinician.bookingApprovalMode = dto.bookingApprovalMode;
    if (dto.consultationTypes || dto.consultationFeeMinor !== undefined) {
      // Ignore legacy `_id` keys in the stored fee map; only real session types
      // are priced.
      const FEE_TYPES = ['clinic', 'audio', 'video', 'text'] as const;
      const types = dto.consultationTypes || FEE_TYPES.filter((type) => (clinician.feeBySessionType as any)?.[type] !== undefined);
      const existingFees = (clinician.feeBySessionType || {}) as Record<string, unknown>;
      const existingAmounts = FEE_TYPES.map((type) => Number(existingFees[type])).filter(
        (amount) => Number.isFinite(amount) && amount > 0,
      );
      const fee = dto.consultationFeeMinor !== undefined
        ? dto.consultationFeeMinor
        : (existingAmounts.length ? Math.max(...existingAmounts) : 0);
      const nextFees: Record<string, number> = {};
      if (Number(fee) > 0) for (const type of types) nextFees[type] = Number(fee);
      clinician.feeBySessionType = nextFees;
    }
    if (dto.listed !== undefined) {
      if (dto.listed && clinician.verificationStatus !== 'verified') {
        throw new UnprocessableEntityException('Only a verified doctor can be listed publicly');
      }
      clinician.active = Boolean(dto.listed);
    }
    await clinician.save();

    await this.logAdminAction(
      adminUser.sub,
      adminUser.roles?.[0] || 'unknown',
      'UPDATE_DOCTOR',
      'care',
      `Updated doctor ${clinician._id}`,
    );
    return { success: true, data: (await this.getDoctor(adminUser, clinicianId)).data, meta: this.meta() };
  }

  /**
   * Account/listing lifecycle. Suspension disables sign-in and removes public
   * listing; deactivation only removes the doctor from discovery. Verification
   * is never granted here — that stays an audited evidence-based decision.
   */
  async setDoctorStatus(adminUser: any, clinicianId: string, status: string, reason?: string) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const clinician = await this.clinicianModel.findById(clinicianId);
    if (!clinician) throw new NotFoundException('Doctor not found');
    const user = await this.userModel.findById(clinician.userId);
    if (!user) throw new NotFoundException('Linked doctor account not found');
    if ((user.roles || []).includes('super_admin')) throw new ForbiddenException('An administrator account cannot be managed as a doctor');

    if (status === 'suspended') {
      user.status = 'suspended';
      clinician.active = false;
      clinician.suspensionReason = reason;
      await this.sessionModelRevoke(user._id as Types.ObjectId);
    } else if (status === 'inactive') {
      clinician.active = false;
      clinician.suspensionReason = reason;
      if (user.status === 'suspended') user.status = 'active';
    } else {
      if (user.status === 'pending_verification') {
        throw new UnprocessableEntityException('This doctor has not activated their invitation yet');
      }
      if (user.status === 'suspended') user.status = 'active';
      clinician.suspensionReason = undefined;
      clinician.active = clinician.verificationStatus === 'verified';
    }
    await user.save();
    await clinician.save();

    await this.logAdminAction(
      adminUser.sub,
      adminUser.roles?.[0] || 'unknown',
      'SET_DOCTOR_STATUS',
      'care',
      `Set doctor ${clinician._id} to ${status}${reason ? ` (${reason})` : ''}`,
    );
    return { success: true, data: (await this.getDoctor(adminUser, clinicianId)).data, meta: this.meta() };
  }

  private async sessionModelRevoke(userId: Types.ObjectId) {
    // Sessions live in their own collection; revoke without importing the model
    // into the Admin module's provider list.
    await this.userModel.db.collection('sessions').updateMany(
      { userId, revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date(), revokeReason: 'ADMIN_DOCTOR_SUSPENDED' } },
    );
  }

  /** Re-issues a single-use activation link for an invited doctor. */
  async inviteDoctor(adminUser: any, clinicianId: string) {
    requireAdminRole(adminUser, ADMIN_ROLES);
    const clinician = await this.clinicianModel.findById(clinicianId).lean().exec();
    if (!clinician) throw new NotFoundException('Doctor not found');
    const user = await this.userModel.findById(clinician.userId);
    if (!user) throw new NotFoundException('Linked doctor account not found');
    if (user.status !== 'pending_verification' && user.passwordHash) {
      throw new ConflictException('This doctor has already activated their account. Use password reset instead.');
    }
    const token = await this.authService.issueDoctorInvitation(user);
    const emailDelivered = await this.mail.trySend('doctor-invitation', () =>
      this.mail.sendDoctorInvitationEmail(user.email, token, clinician.displayName),
    );
    await this.logAdminAction(adminUser.sub, adminUser.roles?.[0] || 'unknown', 'REINVITE_DOCTOR', 'care', `Re-invited doctor ${clinician._id}`);
    return {
      success: true,
      data: {
        emailDelivered,
        emailDelivery: emailDelivered ? 'sent' : 'not_configured',
        expiresInDays: 7,
        ...(!emailDelivered && shouldExposeDevTokens(env().nodeEnv) ? { activationToken: token } : {}),
        message: emailDelivered ? 'Invitation email sent.' : 'Email delivery is not configured; share the single-use invitation link securely.',
      },
      meta: this.meta(),
    };
  }

  async getAuditLogs(adminUser: any) {
    requireAdminRole(adminUser, ['super_admin', 'compliance_officer']);
    const logs = await this.auditLogModel.find().sort({ timestamp: -1 }).limit(100).exec();
    return { success: true, data: logs, meta: this.meta() };
  }

  async logAdminAction(actorUserId: string, actorRole: string, action: string, moduleName: string, details: string) {
    return this.auditLogModel.create({
      actorUserId: new Types.ObjectId(actorUserId),
      actorRole,
      action,
      module: moduleName,
      details,
      timestamp: new Date(),
    });
  }
}
