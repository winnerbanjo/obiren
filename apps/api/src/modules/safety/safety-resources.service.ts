import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  COUNTRY_CONFIGURATIONS,
  EMERGENCY_DIRECTORY_DATASET_VERSION,
  EMERGENCY_RESOURCE_DUE_SOON_DAYS,
  EMERGENCY_RESOURCE_REVIEW_INTERVAL_DAYS,
  EmergencyVerificationStatus,
  VERIFIED_EMERGENCY_DATASET,
  VerifiedEmergencyRecord,
  normalizeEmergencyVerificationStatus,
} from '@obiren/localization';
import { CountryCode } from '@obiren/types';
import {
  EmergencyResourceReview,
  EmergencyResourceReviewDocument,
} from '../../database/schemas/emergency-resource-review.schema';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { requireAdminRole } from '../admin/admin.service';

export type EmergencyResourceFreshness = 'current' | 'due_soon' | 'overdue' | 'unreviewed';

/** Authenticated staff principal as attached by JwtAuthGuard. */
export interface AdminActor {
  sub: string;
  roles?: string[];
}

const DAY_MS = 86_400_000;

/** Emergency services first, then abuse/crisis support, then general care. */
const CATEGORY_PRIORITY = [
  'Emergency services',
  'Emergency healthcare',
  'Urgent healthcare',
  'Sexual violence support',
  'Safety and abuse support',
  'Mental health',
  'Child protection',
  'Women’s healthcare',
  'Pregnancy and maternity',
  'Legal and safety support',
  'Legal and victim support',
  'Hospitals and maternity',
  'Hospitals and urgent care',
];

const DISCLAIMER =
  'These numbers are published by the listed organisations and are checked against their source pages by Obiren editors. They are not a live operational confirmation and Obiren does not dispatch emergency services or guarantee that a provider answers. In an immediate emergency, call your local emergency number.';

@Injectable()
export class SafetyResourcesService {
  constructor(
    @InjectModel(EmergencyResourceReview.name)
    private readonly reviewModel: Model<EmergencyResourceReviewDocument>,
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLogDocument>,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  private freshnessOf(nextReviewDueAt: Date | string | null | undefined, now = new Date()): EmergencyResourceFreshness {
    if (!nextReviewDueAt) return 'unreviewed';
    const dueAt = new Date(nextReviewDueAt).getTime();
    if (Number.isNaN(dueAt)) return 'unreviewed';
    if (dueAt <= now.getTime()) return 'overdue';
    if (dueAt - now.getTime() <= EMERGENCY_RESOURCE_DUE_SOON_DAYS * DAY_MS) return 'due_soon';
    return 'current';
  }

  private baselineStatus(record: VerifiedEmergencyRecord): EmergencyVerificationStatus {
    return normalizeEmergencyVerificationStatus(record.verification_status);
  }

  private sortRecords(records: VerifiedEmergencyRecord[]): VerifiedEmergencyRecord[] {
    return [...records].sort((a, b) => {
      const rankA = CATEGORY_PRIORITY.indexOf(a.top_category);
      const rankB = CATEGORY_PRIORITY.indexOf(b.top_category);
      const orderA = rankA === -1 ? CATEGORY_PRIORITY.length : rankA;
      const orderB = rankB === -1 ? CATEGORY_PRIORITY.length : rankB;
      if (orderA !== orderB) return orderA - orderB;
      return a.record_id.localeCompare(b.record_id);
    });
  }

  private matchesQuery(record: VerifiedEmergencyRecord, query: string): boolean {
    const needle = query.trim().toLowerCase();
    if (!needle) return true;
    return [record.organisation_name, record.service_summary, record.city, record.region, record.phone]
      .filter(Boolean)
      .some((value) => value.toLowerCase().includes(needle));
  }

  /** Public, unauthenticated view of the published emergency directory. */
  async list(params: {
    countryCode?: string;
    category?: string;
    q?: string;
    limit?: number;
  }) {
    const now = new Date();
    const countryCode = (params.countryCode || 'NG') as CountryCode;
    const country = COUNTRY_CONFIGURATIONS[countryCode];
    if (!country) {
      throw new BadRequestException('Unsupported country code');
    }

    const reviews = await this.reviewModel.find({}).lean().exec();
    const reviewByRecord = new Map(reviews.map((review) => [review.recordId, review]));

    let records = VERIFIED_EMERGENCY_DATASET.filter((record) => record.countryCode === countryCode);
    if (params.category) {
      const needle = params.category.trim().toLowerCase();
      records = records.filter(
        (record) =>
          record.top_category.toLowerCase().includes(needle) ||
          record.service_category.toLowerCase().includes(needle),
      );
    }
    if (params.q) {
      records = records.filter((record) => this.matchesQuery(record, params.q!));
    }

    const ordered = this.sortRecords(records);
    const limit = params.limit ?? 50;
    const returned = ordered.slice(0, limit);

    const reviewCounts: Record<EmergencyResourceFreshness, number> = {
      current: 0,
      due_soon: 0,
      overdue: 0,
      unreviewed: 0,
    };

    const resources = returned.map((record) => {
      const review = reviewByRecord.get(record.record_id);
      const baseline = this.baselineStatus(record);
      const status = (review?.verificationStatus as EmergencyVerificationStatus | undefined) ?? baseline;
      const freshness = this.freshnessOf(review?.nextReviewDueAt, now);
      reviewCounts[freshness] += 1;
      return {
        recordId: record.record_id,
        organisationName: record.organisation_name,
        category: record.top_category,
        serviceCategory: record.service_category,
        country: record.country,
        countryCode: record.countryCode,
        region: record.region,
        city: record.city,
        phone: record.phone,
        whatsappOrText: record.whatsapp_or_text,
        email: record.email,
        serviceSummary: record.service_summary,
        hours: record.hours,
        cost: record.cost,
        organisationType: record.organisation_type,
        sourceUrl: record.source_url,
        verification: {
          status,
          baselineStatus: baseline,
          operationallyConfirmed: status === 'operationally_confirmed',
          operationalConfirmationRequired: record.obiren_follow_up.trim().toLowerCase() !== 'none',
          lastCheckedAt: review?.lastCheckedAt ?? null,
          nextReviewDueAt: review?.nextReviewDueAt ?? null,
          freshness,
        },
      };
    });

    return {
      success: true,
      data: {
        countryCode,
        country: country.name,
        datasetVersion: EMERGENCY_DIRECTORY_DATASET_VERSION,
        emergencyNumbers: country.emergencyNumbers,
        disclaimer: DISCLAIMER,
        dispatchSupported: false,
        reviewPolicy: {
          intervalDays: EMERGENCY_RESOURCE_REVIEW_INTERVAL_DAYS,
          dueSoonDays: EMERGENCY_RESOURCE_DUE_SOON_DAYS,
          note: 'freshness reflects recorded staff checks only; an unreviewed resource has never been operationally confirmed.',
        },
        resources,
      },
      meta: {
        ...this.meta(),
        total: records.length,
        returned: resources.length,
        reviewCounts,
      },
    };
  }

  /** Operational view: every published resource plus its recorded review state. */
  async listForAdmin(adminUser: AdminActor, params: { countryCode?: string; freshness?: EmergencyResourceFreshness; limit?: number }) {
    requireAdminRole(adminUser, ['super_admin', 'platform_admin', 'emergency_manager']);
    const now = new Date();
    const reviews = await this.reviewModel.find({}).lean().exec();
    const reviewByRecord = new Map(reviews.map((review) => [review.recordId, review]));

    let records = [...VERIFIED_EMERGENCY_DATASET];
    if (params.countryCode) records = records.filter((record) => record.countryCode === params.countryCode);

    const withState = this.sortRecords(records).map((record) => {
      const review = reviewByRecord.get(record.record_id);
      const status = (review?.verificationStatus as EmergencyVerificationStatus | undefined) ?? this.baselineStatus(record);
      return {
        recordId: record.record_id,
        organisationName: record.organisation_name,
        countryCode: record.countryCode,
        category: record.top_category,
        phone: record.phone,
        sourceUrl: record.source_url,
        editorialFollowUp: record.obiren_follow_up,
        verificationStatus: status,
        operationallyConfirmed: status === 'operationally_confirmed',
        lastCheckedAt: review?.lastCheckedAt ?? null,
        nextReviewDueAt: review?.nextReviewDueAt ?? null,
        checkedByUserId: review?.checkedByUserId ? String(review.checkedByUserId) : null,
        evidenceRef: review?.evidenceRef ?? null,
        note: review?.note ?? null,
        freshness: this.freshnessOf(review?.nextReviewDueAt, now),
      };
    });

    const filtered = params.freshness ? withState.filter((item) => item.freshness === params.freshness) : withState;
    const limit = params.limit ?? 100;
    const counts: Record<EmergencyResourceFreshness, number> = {
      current: 0,
      due_soon: 0,
      overdue: 0,
      unreviewed: 0,
    };
    withState.forEach((item) => {
      counts[item.freshness] += 1;
    });

    return {
      success: true,
      data: { resources: filtered.slice(0, limit) },
      meta: { ...this.meta(), total: filtered.length, returned: Math.min(filtered.length, limit), freshnessCounts: counts },
    };
  }

  /**
   * Record a staff verification decision. The published numbers themselves are
   * still the source of truth; this only records who checked them, when, and
   * how, so freshness is auditable instead of implied.
   */
  async recordReview(
    adminUser: AdminActor,
    recordId: string,
    dto: {
      verificationStatus: EmergencyVerificationStatus;
      evidenceRef?: string;
      note?: string;
      nextReviewDueAt?: string;
    },
  ) {
    requireAdminRole(adminUser, ['super_admin', 'platform_admin', 'emergency_manager']);
    const record = VERIFIED_EMERGENCY_DATASET.find((item) => item.record_id === recordId);
    if (!record) throw new NotFoundException('Emergency resource not found');

    if (dto.verificationStatus === 'operationally_confirmed' && !dto.evidenceRef) {
      throw new BadRequestException(
        'An evidence reference is required before a resource can be marked operationally confirmed',
      );
    }

    const now = new Date();
    const nextReviewDueAt = dto.nextReviewDueAt
      ? new Date(dto.nextReviewDueAt)
      : new Date(now.getTime() + EMERGENCY_RESOURCE_REVIEW_INTERVAL_DAYS * DAY_MS);
    if (nextReviewDueAt.getTime() <= now.getTime()) {
      throw new BadRequestException('nextReviewDueAt must be in the future');
    }

    const update: Record<string, unknown> = {
      verificationStatus: dto.verificationStatus,
      lastCheckedAt: now,
      nextReviewDueAt,
      checkedByUserId: new Types.ObjectId(adminUser.sub),
    };
    if (dto.evidenceRef !== undefined) update.evidenceRef = dto.evidenceRef;
    if (dto.note !== undefined) update.note = dto.note;

    const review = await this.reviewModel
      .findOneAndUpdate({ recordId }, { $set: update }, { new: true, upsert: true, setDefaultsOnInsert: true })
      .lean()
      .exec();

    await this.auditLogModel.create({
      actorUserId: new Types.ObjectId(adminUser.sub),
      actorRole: adminUser.roles?.[0] || 'unknown',
      action: 'REVIEW_EMERGENCY_RESOURCE',
      module: 'safety',
      targetResourceId: recordId,
      details: `Set emergency resource ${recordId} to ${dto.verificationStatus} (next review ${nextReviewDueAt.toISOString()})`,
      timestamp: now,
    });

    return {
      success: true,
      data: {
        recordId,
        organisationName: record.organisation_name,
        verificationStatus: dto.verificationStatus,
        operationallyConfirmed: dto.verificationStatus === 'operationally_confirmed',
        lastCheckedAt: now,
        nextReviewDueAt,
        freshness: this.freshnessOf(nextReviewDueAt, now),
        evidenceRef: review?.evidenceRef ?? null,
        note: review?.note ?? null,
      },
      meta: this.meta(),
    };
  }
}
