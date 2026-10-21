import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConsentService } from './consent.service';
import { UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';

interface ConsentRow {
  purpose: string;
  granted?: boolean;
  policyVersion?: string;
  recordedAt?: Date;
}

const CONSENT_PURPOSES = [
  'terms_of_service_acknowledgement',
  'privacy_notice_acknowledgement',
  'health_data_processing',
  'care_communications',
  'health_sharing',
  'location_sharing',
  'marketing',
];

@Injectable()
export class PrivacySettingsService {
  constructor(
    private readonly consentService: ConsentService,
    @InjectModel(UserProfile.name) private readonly profileModel: Model<UserProfileDocument>,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  /**
   * A single privacy screen built from the authoritative sources: consent comes
   * from the append-only event history, while analytics/crash/personalisation
   * are ordinary preferences. The response never merges the two.
   */
  async get(userId: string) {
    const history = await this.consentService.getHistory(userId);
    const current = (history.data as { current: ConsentRow[] }).current || [];
    const byPurpose = new Map(current.map((event) => [event.purpose, event]));
    const profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();

    const purposes = CONSENT_PURPOSES.map((purpose) => {
      const event = byPurpose.get(purpose);
      return {
        purpose,
        granted: event ? Boolean(event.granted) : null,
        policyVersion: event?.policyVersion ?? null,
        recordedAt: event?.recordedAt ?? null,
        decided: Boolean(event),
      };
    });

    return {
      success: true,
      data: {
        purposes,
        undecidedPurposes: purposes.filter((entry) => !entry.decided).map((entry) => entry.purpose),
        preferences: {
          shareAnalytics: profile?.privacyPreferences?.shareAnalytics ?? false,
          shareCrashReports: profile?.privacyPreferences?.shareCrashReports ?? false,
          personalizedContent: profile?.privacyPreferences?.personalizedContent ?? false,
        },
        dataControls: {
          exportAvailable: true,
          deletionAvailable: true,
          deletionWindowDays: 30,
          erasureNote: 'Erasure runs under the documented retention rules; some payment records may be retained where law requires it.',
        },
        note: 'Changing a purpose appends a consent event; a recorded decision is never silently overwritten.',
      },
      meta: this.meta(),
    };
  }

  async update(
    userId: string,
    input: {
      purposes?: Array<{ purpose: string; granted: boolean; policyVersion: string }>;
      shareAnalytics?: boolean;
      shareCrashReports?: boolean;
      personalizedContent?: boolean;
    },
  ) {
    const changedPurposes: string[] = [];
    for (const decision of input.purposes ?? []) {
      await this.consentService.record(userId, {
        purpose: decision.purpose,
        policyVersion: decision.policyVersion,
        granted: decision.granted,
        source: 'settings',
      });
      changedPurposes.push(decision.purpose);
    }

    const preferenceUpdate: Record<string, boolean> = {};
    if (input.shareAnalytics !== undefined) preferenceUpdate['privacyPreferences.shareAnalytics'] = input.shareAnalytics;
    if (input.shareCrashReports !== undefined) preferenceUpdate['privacyPreferences.shareCrashReports'] = input.shareCrashReports;
    if (input.personalizedContent !== undefined) preferenceUpdate['privacyPreferences.personalizedContent'] = input.personalizedContent;
    if (Object.keys(preferenceUpdate).length > 0) {
      await this.profileModel.updateOne(
        { userId: new Types.ObjectId(userId) },
        { $set: preferenceUpdate, $setOnInsert: { userId: new Types.ObjectId(userId) } },
        { upsert: true },
      );
    }

    const updated = await this.get(userId);
    return {
      success: true,
      data: { ...updated.data, changedPurposes },
      meta: this.meta(),
    };
  }
}
