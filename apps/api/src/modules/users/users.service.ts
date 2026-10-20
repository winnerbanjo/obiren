import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { Onboarding, OnboardingDocument } from '../../database/schemas/onboarding.schema';
import { Cycle, CycleDocument } from '../../database/schemas/cycle.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Onboarding.name) private onboardingModel: Model<OnboardingDocument>,
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
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
        onboardingStatus: profile?.onboardingStatus || 'PENDING',
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async getOnboarding(userId: string) {
    const draft = await this.onboardingModel.findOne({ userId: new Types.ObjectId(userId) });
    return {
      success: true,
      data: draft || { step: 1, status: 'in_progress', conditions: [], concerns: [] },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async updateOnboarding(userId: string, updates: Record<string, unknown>) {
    const userObjectId = new Types.ObjectId(userId);
    const profile = await this.userProfileModel.findOne({ userId: userObjectId });
    if (!profile) throw new NotFoundException('User profile not found');
    if (profile.onboardingStatus === 'COMPLETED') {
      throw new UnprocessableEntityException('Onboarding is already complete');
    }

    const existingDraft = await this.onboardingModel.findOne({ userId: userObjectId, status: 'in_progress' });
    const currentStep = existingDraft?.step ?? 1;
    const requestedStep = updates.step;
    if (typeof requestedStep === 'number' && requestedStep > currentStep + 1) {
      throw new UnprocessableEntityException('Onboarding steps must be completed in order');
    }

    const draft = await this.onboardingModel.findOneAndUpdate(
      { userId: userObjectId, status: 'in_progress' },
      { $set: updates, $setOnInsert: { userId: userObjectId, status: 'in_progress' } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
    await this.userProfileModel.updateOne({ userId: userObjectId }, { $set: { onboardingStatus: 'PENDING' } });
    return { success: true, data: draft, meta: { requestId: `req_${Date.now()}` } };
  }

  async completeOnboarding(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const profile = await this.userProfileModel.findOne({ userId: userObjectId });
    if (!profile) throw new NotFoundException('User profile not found');
    if (profile.onboardingStatus === 'COMPLETED') {
      return { success: true, data: { status: 'COMPLETED' }, meta: { requestId: `req_${Date.now()}` } };
    }

    const draft = await this.onboardingModel.findOne({ userId: userObjectId, status: 'in_progress' });
    if (!draft || draft.step !== 8) {
      throw new UnprocessableEntityException('Complete all eight onboarding steps before finishing');
    }
    if (!draft.objective) {
      throw new UnprocessableEntityException('An onboarding objective is required');
    }

    const savedProfile = await this.userProfileModel.findOneAndUpdate(
      { userId: userObjectId },
      { $set: { trackingGoal: draft.objective, onboardingStatus: 'COMPLETED' } },
      { new: true },
    );

    if (draft.lastMenstrualPeriod && draft.objective === 'CYCLE_TRACKING') {
      const startOfDay = new Date(`${draft.lastMenstrualPeriod}T00:00:00.000Z`);
      const endOfDay = new Date(`${draft.lastMenstrualPeriod}T23:59:59.999Z`);
      const existingBaseline = await this.cycleModel.findOne({
        userId: userObjectId,
        startedAt: { $gte: startOfDay, $lte: endOfDay },
      });
      const activeCycle = await this.cycleModel.findOne({ userId: userObjectId, status: 'active' });
      if (!existingBaseline && !activeCycle) {
        await this.cycleModel.create({
          userId: userObjectId,
          startedAt: startOfDay,
          source: 'user_logged',
          status: 'active',
        });
      }
    }

    draft.status = 'completed';
    draft.completedAt = new Date();
    await draft.save();
    return {
      success: true,
      data: { status: 'COMPLETED', profile: savedProfile, onboarding: draft },
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
