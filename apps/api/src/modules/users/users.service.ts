import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { User, UserDocument, UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { Onboarding, OnboardingDocument } from '../../database/schemas/onboarding.schema';
import { Cycle, CycleDocument } from '../../database/schemas/cycle.schema';
import { PrivacyJob, PrivacyJobDocument } from '../../database/schemas/privacy-job.schema';
import { Session, SessionDocument } from '../../database/schemas/session.schema';
import { DailyLog, DailyLogDocument } from '../../database/schemas/cycle.schema';
import { Pregnancy, PregnancyDocument, PregnancyLog, PregnancyLogDocument } from '../../database/schemas/pregnancy.schema';
import { ConsentEvent, ConsentDocument } from '../../database/schemas/consent.schema';
import { NotificationOutbox, NotificationOutboxDocument } from '../../database/schemas/notification.schema';
import { HealthVaultDoc, HealthVaultDocDocument } from '../../database/schemas/health-vault.schema';
import { SafetyIncident, SafetyIncidentDocument, GuardianContact, GuardianContactDocument } from '../../database/schemas/safety.schema';
import { Consultation, ConsultationDocument, Device, DeviceDocument, Message, MessageDocument } from '../../database/schemas/communications.schema';
import { decryptHealthNote } from '../../common/crypto/health-data-crypto';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
    @InjectModel(Onboarding.name) private onboardingModel: Model<OnboardingDocument>,
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(PrivacyJob.name) private privacyJobModel: Model<PrivacyJobDocument>,
    @InjectModel(Session.name) private sessionModel: Model<SessionDocument>,
    @InjectModel(DailyLog.name) private dailyLogModel: Model<DailyLogDocument>,
    @InjectModel(Pregnancy.name) private pregnancyModel: Model<PregnancyDocument>,
    @InjectModel(PregnancyLog.name) private pregnancyLogModel: Model<PregnancyLogDocument>,
    @InjectModel(ConsentEvent.name) private consentModel: Model<ConsentDocument>,
    @InjectModel(NotificationOutbox.name) private notificationModel: Model<NotificationOutboxDocument>,
    @InjectModel(HealthVaultDoc.name) private vaultModel: Model<HealthVaultDocDocument>,
    @InjectModel(SafetyIncident.name) private incidentModel: Model<SafetyIncidentDocument>,
    @InjectModel(GuardianContact.name) private guardianModel: Model<GuardianContactDocument>,
    @InjectModel(Consultation.name) private consultationModel: Model<ConsultationDocument>,
    @InjectModel(Message.name) private messageModel: Model<MessageDocument>,
    @InjectModel(Device.name) private deviceModel: Model<DeviceDocument>,
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
    const id = new Types.ObjectId(userId);
    const [user, profile, onboarding, cycles, dailyLogs, pregnancies, pregnancyLogs, consents, notifications, vaultDocuments, safetyIncidents, guardians, sessions, consultations, devices] = await Promise.all([
      this.userModel.findById(id).select('-passwordHash -emailVerificationTokenHash -passwordResetTokenHash').lean().exec(),
      this.userProfileModel.findOne({ userId: id }).lean().exec(),
      this.onboardingModel.findOne({ userId: id }).lean().exec(),
      this.cycleModel.find({ userId: id }).lean().exec(),
      this.dailyLogModel.find({ userId: id }).lean().exec(),
      this.pregnancyModel.find({ userId: id }).lean().exec(),
      this.pregnancyLogModel.find({ userId: id }).lean().exec(),
      this.consentModel.find({ userId: id }).lean().exec(),
      this.notificationModel.find({ userId: id }).select('-templateData').lean().exec(),
      this.vaultModel.find({ userId: id }).lean().exec(),
      this.incidentModel.find({ userId: id }).lean().exec(),
      this.guardianModel.find({ ownerUserId: id }).lean().exec(),
      this.sessionModel.find({ userId: id }).select('platform createdAt lastUsedAt expiresAt revokedAt').lean().exec(),
      this.consultationModel.find({ participantUserIds: id }).select('patientUserId clinicianUserId status lastMessageAt closedAt createdAt').lean().exec(),
      this.deviceModel.find({ userId: id }).select('platform deviceName status lastSeenAt createdAt revokedAt').lean().exec(),
    ]);
    const consultationIds = consultations.map((row) => row._id);
    const messageDocs = consultationIds.length
      ? await this.messageModel.find({ consultationId: { $in: consultationIds } }).sort({ createdAt: 1 }).lean().exec()
      : [];
    const consultationMessages = messageDocs.map((message) => {
      let body: string;
      try {
        body = decryptHealthNote({ ciphertext: message.ciphertext, iv: message.iv, authTag: message.authTag, keyId: message.keyId });
      } catch {
        body = '[content could not be decrypted with the current key]';
      }
      return { id: message._id.toString(), consultationId: message.consultationId.toString(), senderUserId: message.senderUserId.toString(), body, status: message.status, createdAt: (message as any).createdAt };
    });
    const job = await this.privacyJobModel.create({ userId: id, type: 'export', status: 'completed', requestedAt: new Date(), completedAt: new Date(), expiresAt: new Date(Date.now() + 7 * 86400000) });
    return { success: true, data: { exportVersion: '1.2', status: 'ready', jobId: job._id.toString(), user, profile, onboarding, cycles, dailyLogs, pregnancies, pregnancyLogs, consents, notifications, vaultDocuments, safetyIncidents, guardians, sessions, consultations, consultationMessages, devices, exportedAt: new Date().toISOString(), expiresAt: job.expiresAt }, meta: { requestId: `req_${Date.now()}` } };
  }

  async requestAccountDeletion(userId: string) {
    const now = new Date();
    const scheduledAt = new Date(now.getTime() + 30 * 86400000);
    const user = await this.userModel.findOneAndUpdate({ _id: new Types.ObjectId(userId), status: { $ne: 'deleted' } }, { $set: { status: 'deletion_pending', deletionRequestedAt: now } }, { new: true });
    if (!user) throw new NotFoundException('User not found or already deleted');
    const job = await this.privacyJobModel.create({ userId: user._id, type: 'deletion', status: 'requested', requestedAt: now, availableAt: scheduledAt });
    return { success: true, data: { userId: user._id, status: 'deletion_pending', jobId: job._id.toString(), executionStatus: 'pending_operator_worker', gracePeriodDays: 30, deletionScheduledFor: scheduledAt, erasureCompleted: false }, meta: { requestId: `req_${Date.now()}` } };
  }

  async getPrivacyJobs(userId: string) {
    const jobs = await this.privacyJobModel.find({ userId: new Types.ObjectId(userId) }).sort({ requestedAt: -1 }).limit(50).lean().exec();
    return { success: true, data: jobs, meta: { requestId: `req_${Date.now()}` } };
  }

  async cancelAccountDeletion(userId: string) {
    const id = new Types.ObjectId(userId);
    const user = await this.userModel.findOneAndUpdate({ _id: id, status: 'deletion_pending' }, { $set: { status: 'active' }, $unset: { deletionRequestedAt: 1 } }, { new: true });
    if (!user) throw new NotFoundException('No pending deletion request found');
    await this.privacyJobModel.updateMany({ userId: id, type: 'deletion', status: 'requested' }, { $set: { status: 'cancelled' } });
    return { success: true, data: { userId: user._id, status: user.status, deletionCancelled: true }, meta: { requestId: `req_${Date.now()}` } };
  }
}
