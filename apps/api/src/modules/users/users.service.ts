import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
  ) {}

  async getProfile(userId: string) {
    const profile = await this.userProfileModel.findOne({ userId: new Types.ObjectId(userId) });
    const user = await this.userModel.findById(userId);

    if (!user) {
      throw new NotFoundException('User profile not found');
    }

    return {
      success: true,
      data: {
        userId: user._id.toString(),
        email: user.email,
        countryCode: user.countryCode,
        status: user.status,
        roles: user.roles,
        firstName: profile?.firstName || '',
        lastName: profile?.lastName || '',
        displayName: profile?.displayName || '',
        trackingGoal: profile?.trackingGoal || 'CYCLE_TRACKING',
        onboardingStatus: profile?.onboardingStatus || 'COMPLETED',
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async updateProfile(userId: string, updates: any) {
    const profile = await this.userProfileModel.findOneAndUpdate(
      { userId: new Types.ObjectId(userId) },
      { $set: updates },
      { new: true, upsert: true },
    );

    return {
      success: true,
      data: profile,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async exportUserData(userId: string) {
    const user = await this.userModel.findById(userId);
    const profile = await this.userProfileModel.findOne({ userId: new Types.ObjectId(userId) });

    return {
      success: true,
      data: {
        exportVersion: '1.0',
        complianceFramework: 'NDPR / GDPR Article 20',
        user: {
          id: user?._id,
          email: user?.email,
          countryCode: user?.countryCode,
          status: user?.status,
        },
        profile,
        exportedAt: new Date().toISOString(),
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async requestAccountDeletion(userId: string) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          status: 'deletion_pending',
          deletionRequestedAt: new Date(),
        },
      },
      { new: true },
    );

    return {
      success: true,
      data: {
        userId: user?._id,
        status: user?.status,
        gracePeriodDays: 30,
        deletionScheduledFor: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async cancelAccountDeletion(userId: string) {
    const user = await this.userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          status: 'active',
        },
        $unset: { deletionRequestedAt: 1 },
      },
      { new: true },
    );

    return {
      success: true,
      data: { userId: user?._id, status: user?.status },
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
