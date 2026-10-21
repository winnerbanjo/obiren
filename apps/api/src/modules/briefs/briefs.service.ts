import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { HealthBrief, HealthBriefDocument } from '../../database/schemas/briefs.schema';
import { Cycle, CycleDocument, DailyLog, DailyLogDocument } from '../../database/schemas/cycle.schema';
import { Pregnancy, PregnancyDocument } from '../../database/schemas/pregnancy.schema';
import { ConsentEvent, ConsentDocument } from '../../database/schemas/consent.schema';
import { Clinician, ClinicianDocument } from '../../database/schemas/care.schema';

const GENERATOR_VERSION = 'health-brief-v1.0.0';
interface BriefView {
  _id: Types.ObjectId;
  ownerUserId: Types.ObjectId;
  recipientUserId: Types.ObjectId;
  scopes: string[];
  evidenceFrom: string;
  evidenceTo: string;
  recordCounts?: { cycles?: number; dailyLogs?: number; pregnancies?: number };
  contentHash: string;
  generatorVersion: string;
  expiresAt: Date;
  revokedAt?: Date;
  createdAt?: Date;
}

const BRIEF_DISCLAIMER =
  'User-approved record summary. It is a snapshot of logged data, not a diagnosis or clinical opinion.';

@Injectable()
export class BriefsService {
  constructor(
    @InjectModel(HealthBrief.name) private readonly briefModel: Model<HealthBriefDocument>,
    @InjectModel(Cycle.name) private readonly cycleModel: Model<CycleDocument>,
    @InjectModel(DailyLog.name) private readonly dailyLogModel: Model<DailyLogDocument>,
    @InjectModel(Pregnancy.name) private readonly pregnancyModel: Model<PregnancyDocument>,
    @InjectModel(ConsentEvent.name) private readonly consentModel: Model<ConsentDocument>,
    @InjectModel(Clinician.name) private readonly clinicianModel: Model<ClinicianDocument>,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  /**
   * Deterministic generation: records are selected by scope and range, sorted
   * by date, stripped of free-text notes, then hashed. No LLM, no inference.
   */
  async generate(
    ownerUserId: string,
    input: { recipientUserId: string; scopes: string[]; from: string; to: string; expiresAt: string },
  ) {
    if (ownerUserId === input.recipientUserId) {
      throw new BadRequestException('A separate recipient account is required');
    }

    const consent = await this.consentModel
      .find({ userId: new Types.ObjectId(ownerUserId), purpose: 'health_sharing' })
      .sort({ recordedAt: -1, _id: -1 })
      .limit(1)
      .lean()
      .exec();
    if (!consent[0]?.granted) throw new NotFoundException('Current health-sharing consent is required');

    const clinician = await this.clinicianModel
      .findOne({
        userId: new Types.ObjectId(input.recipientUserId),
        verificationStatus: 'verified',
        active: true,
      })
      .lean()
      .exec();
    if (!clinician) throw new NotFoundException('A verified, active clinician recipient is required');

    const owner = new Types.ObjectId(ownerUserId);
    const rangeStart = new Date(`${input.from}T00:00:00.000Z`);
    const rangeEnd = new Date(`${input.to}T23:59:59.999Z`);

    const cycles = input.scopes.includes('cycles')
      ? await this.cycleModel
          .find({ userId: owner, startedAt: { $gte: rangeStart, $lte: rangeEnd } })
          .select('startedAt periodEndedAt periodLength cycleLength status')
          .sort({ startedAt: 1, _id: 1 })
          .lean()
          .exec()
      : [];

    // `notes` is deliberately not selected: free text is excluded from briefs.
    const dailyLogs = input.scopes.includes('daily_logs')
      ? await this.dailyLogModel
          .find({ userId: owner, date: { $gte: input.from, $lte: input.to } })
          .select('date mode bleeding bloodColor pain moods symptoms energy cravings sleep')
          .sort({ date: 1, _id: 1 })
          .lean()
          .exec()
      : [];

    const pregnancies = input.scopes.includes('pregnancy')
      ? await this.pregnancyModel
          .find({ userId: owner })
          .select('status lastMenstrualPeriod estimatedDueDate calculationSource dateConfidence')
          .sort({ createdAt: -1, _id: 1 })
          .lean()
          .exec()
      : [];

    const snapshot = {
      generator: GENERATOR_VERSION,
      range: { from: input.from, to: input.to },
      scopes: [...input.scopes].sort(),
      recordCounts: { cycles: cycles.length, dailyLogs: dailyLogs.length, pregnancies: pregnancies.length },
      cycles,
      dailyLogs,
      pregnancies,
      disclaimer: BRIEF_DISCLAIMER,
    };
    const contentHash = crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

    const brief = await this.briefModel.create({
      ownerUserId: owner,
      recipientUserId: new Types.ObjectId(input.recipientUserId),
      scopes: snapshot.scopes,
      evidenceFrom: input.from,
      evidenceTo: input.to,
      snapshot,
      contentHash,
      recordCounts: snapshot.recordCounts,
      generatorVersion: GENERATOR_VERSION,
      expiresAt: new Date(input.expiresAt),
    });

    return {
      success: true,
      data: {
        id: brief._id.toString(),
        contentHash,
        generatorVersion: GENERATOR_VERSION,
        scopes: snapshot.scopes,
        range: snapshot.range,
        recordCounts: snapshot.recordCounts,
        expiresAt: brief.expiresAt,
        notesIncluded: false,
      },
      meta: this.meta(),
    };
  }

  private present(brief: BriefView) {
    return {
      id: brief._id.toString(),
      ownerUserId: brief.ownerUserId.toString(),
      recipientUserId: brief.recipientUserId.toString(),
      scopes: brief.scopes,
      range: { from: brief.evidenceFrom, to: brief.evidenceTo },
      recordCounts: brief.recordCounts,
      contentHash: brief.contentHash,
      generatorVersion: brief.generatorVersion,
      expiresAt: brief.expiresAt,
      revokedAt: brief.revokedAt ?? null,
      createdAt: brief.createdAt,
    };
  }

  /** Owner or recipient only; expired and revoked briefs are not returned. */
  async get(userId: string, briefId: string) {
    const brief = await this.briefModel
      .findOne({
        _id: new Types.ObjectId(briefId),
        $or: [{ ownerUserId: new Types.ObjectId(userId) }, { recipientUserId: new Types.ObjectId(userId) }],
      })
      .lean()
      .exec();
    if (!brief) throw new NotFoundException('Brief not found for this account');
    if (brief.revokedAt) throw new NotFoundException('Brief has been revoked');
    if (brief.expiresAt.getTime() <= Date.now()) throw new NotFoundException('Brief has expired');
    return {
      success: true,
      data: {
        ...this.present(brief as unknown as BriefView),
        snapshot: brief.snapshot,
        // Recipients see the evidence; the owner additionally sees it is their record.
        viewerRole: brief.ownerUserId.toString() === userId ? 'owner' : 'recipient',
      },
      meta: this.meta(),
    };
  }

  async listForRecipient(userId: string) {
    const rows = await this.briefModel
      .find({ recipientUserId: new Types.ObjectId(userId), revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } })
      .sort({ _id: -1 })
      .limit(50)
      .lean()
      .exec();
    return {
      success: true,
      data: { briefs: rows.map((brief) => this.present(brief as unknown as BriefView)) },
      meta: { ...this.meta(), total: rows.length },
    };
  }

  async revoke(ownerUserId: string, briefId: string) {
    const brief = await this.briefModel.findOneAndUpdate(
      { _id: new Types.ObjectId(briefId), ownerUserId: new Types.ObjectId(ownerUserId), revokedAt: { $exists: false } },
      { $set: { revokedAt: new Date() } },
      { new: true },
    );
    if (!brief) throw new NotFoundException('Active brief not found for this account');
    return { success: true, data: { id: briefId, status: 'revoked' }, meta: this.meta() };
  }
}
