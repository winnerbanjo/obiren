import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { Pregnancy, PregnancyDocument } from '../../database/schemas/pregnancy.schema';
import { DirectoryService, DirectoryServiceDocument } from '../../database/schemas/directory.schema';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Pregnancy.name) private pregnancyModel: Model<PregnancyDocument>,
    @InjectModel(DirectoryService.name) private directoryModel: Model<DirectoryServiceDocument>,
  ) {}

  // PRD Section 30 & Audit 13 Requirement: Real MongoDB Aggregations (No hardcoded data!)
  async getMetrics(adminUser: any) {
    if (!adminUser.roles.includes('super_admin') && !adminUser.roles.includes('platform_admin')) {
      throw new ForbiddenException('Access denied: Requires administrative role');
    }

    const totalUsers = await this.userModel.countDocuments();
    const activePregnancies = await this.pregnancyModel.countDocuments({ status: 'active' });
    const verifiedEmergencyResources = await this.directoryModel.countDocuments({ verification_status: 'Source verified' });

    // Aggregate users by country
    const countryAgg = await this.userModel.aggregate([
      { $group: { _id: '$countryCode', count: { $sum: 1 } } },
    ]);

    const countryBreakdown: Record<string, any> = {};
    countryAgg.forEach((c) => {
      countryBreakdown[c._id] = { users: c.count };
    });

    return {
      success: true,
      data: {
        totalUsers,
        activePregnancies,
        verifiedEmergencyResources,
        countryBreakdown,
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async getAuditLogs(adminUser: any) {
    if (!adminUser.roles.includes('super_admin') && !adminUser.roles.includes('compliance_officer')) {
      throw new ForbiddenException('Access denied: Requires compliance or super admin privileges');
    }

    const logs = await this.auditLogModel.find().sort({ timestamp: -1 }).limit(100).exec();
    return {
      success: true,
      data: logs,
      meta: { requestId: `req_${Date.now()}` },
    };
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
