import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Pregnancy, PregnancyDocument } from '../../database/schemas/pregnancy.schema';
import { DirectoryService, DirectoryServiceDocument } from '../../database/schemas/directory.schema';
import { Clinician, ClinicianDocument } from '../../database/schemas/care.schema';
import { Consultation, ConsultationDocument } from '../../database/schemas/communications.schema';

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
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  async getMetrics(adminUser: any) {
    requireAdminRole(adminUser, ADMIN_ROLES);

    const totalUsers = await this.userModel.countDocuments();
    const activePregnancies = await this.pregnancyModel.countDocuments({ status: 'active' });
    const verifiedEmergencyResources = await this.directoryModel.countDocuments({
      verification_status: 'Source verified',
    });

    const countryAgg = await this.userModel.aggregate([{ $group: { _id: '$countryCode', count: { $sum: 1 } } }]);
    const countryBreakdown: Record<string, any> = {};
    countryAgg.forEach((c) => {
      countryBreakdown[c._id || 'unknown'] = { users: c.count };
    });

    return {
      success: true,
      data: { totalUsers, activePregnancies, verifiedEmergencyResources, countryBreakdown },
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
    if (user.roles.includes('super_admin') && !adminUser.roles.includes('super_admin')) {
      throw new ForbiddenException('Only a super admin can modify another super admin.');
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
