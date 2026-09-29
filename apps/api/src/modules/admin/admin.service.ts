import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Pregnancy, PregnancyDocument } from '../../database/schemas/pregnancy.schema';
import { DirectoryService, DirectoryServiceDocument } from '../../database/schemas/directory.schema';

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
