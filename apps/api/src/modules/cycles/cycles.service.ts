import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { calculateCyclePrediction } from '@obiren/health-engine';
import { Cycle, CycleDocument, DailyLog, DailyLogDocument } from '../../database/schemas/cycle.schema';
import { decryptHealthNote, encryptHealthNote } from '../../common/crypto/health-data-crypto';

@Injectable()
export class CyclesService {
  constructor(
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(DailyLog.name) private dailyLogModel: Model<DailyLogDocument>,
  ) {}

  async getCurrentCycle(userId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const activeCycle = await this.cycleModel
      .findOne({ userId: userObjectId, status: 'active' })
      .sort({ startedAt: -1 });

    if (!activeCycle) {
      return {
        success: true,
        data: null,
        meta: { requestId: `req_${Date.now()}` },
      };
    }

    const profile = await this.cycleModel.db.collection('user_profiles').findOne({ userId: userObjectId });
    const timeZone = profile?.timeZone || 'Africa/Lagos';
    const dateInZone = (date: Date) => {
      const parts = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).formatToParts(date);
      const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
      return `${values.year}-${values.month}-${values.day}`;
    };
    const startLocalDate = dateInZone(activeCycle.startedAt);
    const todayLocalDate = dateInZone(new Date());
    const dayOfCycle = Math.max(1, Math.floor((Date.parse(`${todayLocalDate}T00:00:00Z`) - Date.parse(`${startLocalDate}T00:00:00Z`)) / 86400000) + 1);
    const history = await this.cycleModel.find({ userId: userObjectId, status: { $ne: 'deleted' } }).sort({ startedAt: -1 }).limit(7).exec();
    const prediction = calculateCyclePrediction({
      userId,
      confirmedCycles: history.map((cycle) => ({ periodStartDate: dateInZone(cycle.startedAt) })),
    });

    return {
      success: true,
      data: {
        id: activeCycle._id.toString(),
        userId: activeCycle.userId.toString(),
        startedAt: startLocalDate,
        dayOfCycle,
        status: activeCycle.status,
        timeZone,
        prediction: {
          predictedStartDate: prediction.predictedStartDate,
          predictedEndDate: prediction.predictedEndDate,
          periodPrediction: { startDate: prediction.predictedStartDate, rangeStart: prediction.rangeStart, rangeEnd: prediction.rangeEnd },
          fertileWindow: { startDate: prediction.estimatedFertileWindowStart, endDate: prediction.estimatedFertileWindowEnd },
          ovulationEstimate: prediction.estimatedOvulationDate,
          confidence: prediction.confidence,
          explanationCode: prediction.explanationCode,
          calculationVersion: prediction.calculationVersion,
          isContraceptiveAdvice: false,
        },
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async getCycleHistory(userId: string, query: { from?: string; to?: string; cursor?: string; limit: number } = { limit: 20 }) {
    const userObjectId = new Types.ObjectId(userId);
    const filter: Record<string, any> = { userId: userObjectId, status: { $ne: 'deleted' } };
    if (query.from || query.to) {
      filter.startedAt = {
        ...(query.from ? { $gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
        ...(query.to ? { $lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
      };
    }
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const limit = query.limit || 20;
    const baseFilter = { userId: userObjectId, status: { $ne: 'deleted' }, ...(query.from || query.to ? { startedAt: {
      ...(query.from ? { $gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
      ...(query.to ? { $lte: new Date(`${query.to}T23:59:59.999Z`) } : {}),
    } } : {}) };
    const [rows, allStarts, total] = await Promise.all([
      this.cycleModel.find(filter).sort({ _id: -1 }).limit(limit + 1).exec(),
      this.cycleModel.find(baseFilter).select('startedAt').sort({ startedAt: 1 }).lean().exec(),
      this.cycleModel.countDocuments(baseFilter),
    ]);
    const hasNext = rows.length > limit;
    const cycles = rows.slice(0, limit);
    const intervals: number[] = [];
    for (let index = 1; index < allStarts.length; index += 1) {
      const days = Math.round((allStarts[index].startedAt.getTime() - allStarts[index - 1].startedAt.getTime()) / 86400000);
      if (days >= 20 && days <= 45) intervals.push(days);
    }
    const avgCycleLength = intervals.length ? Math.round(intervals.reduce((sum, value) => sum + value, 0) / intervals.length) : null;

    return {
      success: true,
      data: {
        cycles,
        summary: { recordedCycleCount: total, usableIntervalCount: intervals.length, avgCycleLength, confidence: intervals.length >= 2 ? 'PERSONALIZED' : 'LOW', isContraceptiveAdvice: false },
        nextCursor: hasNext ? cycles[cycles.length - 1]._id.toString() : null,
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async getCycleHistoryDetail(userId: string, cycleId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const cycle = await this.cycleModel.findOne({ _id: new Types.ObjectId(cycleId), userId: userObjectId, status: { $ne: 'deleted' } }).exec();
    if (!cycle) throw new NotFoundException('Cycle not found');
    const from = cycle.startedAt.toISOString().slice(0, 10);
    const naturalEnd = cycle.periodEndedAt || (cycle.endedAt ? new Date(cycle.endedAt.getTime() - 86400000) : cycle.startedAt);
    const to = naturalEnd.toISOString().slice(0, 10);
    const logs = await this.dailyLogModel.find({ userId: userObjectId, date: { $gte: from, $lte: to } }).sort({ date: 1 }).lean().exec();
    const flowCounts = logs.reduce<Record<string, number>>((counts, log) => {
      const flow = log.bleeding?.level || 'none';
      counts[flow] = (counts[flow] || 0) + 1;
      return counts;
    }, {});
    return { success: true, data: { cycle, dailyLogs: logs, flowPattern: flowCounts }, meta: { requestId: `req_${Date.now()}` } };
  }

  async updateCycle(userId: string, cycleId: string, updates: { startDate?: string; endDate?: string | null; notes?: string | null }) {
    const userObjectId = new Types.ObjectId(userId);
    const cycle = await this.cycleModel.findOne({ _id: new Types.ObjectId(cycleId), userId: userObjectId, status: { $ne: 'deleted' } }).exec();
    if (!cycle) throw new NotFoundException('Cycle not found');

    const nextStart = updates.startDate ? new Date(`${updates.startDate}T00:00:00.000Z`) : cycle.startedAt;
    let nextEnd = updates.endDate === undefined ? cycle.periodEndedAt : updates.endDate ? new Date(`${updates.endDate}T00:00:00.000Z`) : undefined;
    if (updates.startDate && updates.endDate === undefined && nextEnd && nextEnd < nextStart) {
      nextEnd = undefined;
    }
    if (nextEnd && nextEnd < nextStart) throw new BadRequestException('Period end date cannot be before its start date');

    if (updates.startDate) {
      const duplicate = await this.cycleModel.findOne({
        _id: { $ne: cycle._id }, userId: userObjectId, status: { $ne: 'deleted' },
        startedAt: { $gte: nextStart, $lte: new Date(`${updates.startDate}T23:59:59.999Z`) },
      });
      if (duplicate) throw new BadRequestException('A period is already recorded for that start date');
      const nextCycle = await this.cycleModel.findOne({
        _id: { $ne: cycle._id }, userId: userObjectId, status: { $ne: 'deleted' }, startedAt: { $gt: cycle.startedAt },
      }).sort({ startedAt: 1 });
      const prevCycle = await this.cycleModel.findOne({
        _id: { $ne: cycle._id }, userId: userObjectId, status: { $ne: 'deleted' }, startedAt: { $lt: cycle.startedAt },
      }).sort({ startedAt: -1 });
      if (nextCycle && nextStart >= nextCycle.startedAt) throw new BadRequestException('Period start cannot overlap the next recorded cycle');
      if (prevCycle && nextStart <= prevCycle.startedAt) throw new BadRequestException('Period start must follow the previous recorded cycle');
      cycle.startedAt = nextStart;
      if (cycle.status === 'active') {
        const followingCycle = await this.cycleModel.findOne({ _id: { $ne: cycle._id }, userId: userObjectId, status: { $ne: 'deleted' }, startedAt: { $gt: nextStart } }).sort({ startedAt: 1 });
        if (followingCycle) {
          cycle.status = 'completed';
          cycle.endedAt = followingCycle.startedAt;
          cycle.cycleLength = Math.floor((followingCycle.startedAt.getTime() - nextStart.getTime()) / 86400000);
        }
      }
      const precedingCycle = await this.cycleModel.findOne({ _id: { $ne: cycle._id }, userId: userObjectId, status: { $ne: 'deleted' }, startedAt: { $lt: nextStart } }).sort({ startedAt: -1 });
      if (precedingCycle) {
        precedingCycle.cycleLength = Math.floor((nextStart.getTime() - precedingCycle.startedAt.getTime()) / 86400000);
        if (precedingCycle.status === 'active') {
          precedingCycle.status = 'completed';
          precedingCycle.endedAt = nextStart;
        }
        await precedingCycle.save();
      }
      const followingCycle = await this.cycleModel.findOne({ _id: { $ne: cycle._id }, userId: userObjectId, status: { $ne: 'deleted' }, startedAt: { $gt: nextStart } }).sort({ startedAt: 1 });
      cycle.cycleLength = followingCycle ? Math.floor((followingCycle.startedAt.getTime() - nextStart.getTime()) / 86400000) : undefined;
    }

    if (nextEnd) {
      const nextCycle = await this.cycleModel.findOne({
        _id: { $ne: cycle._id }, userId: userObjectId, status: { $ne: 'deleted' }, startedAt: { $gt: cycle.startedAt },
      }).sort({ startedAt: 1 });
      if (nextCycle && nextEnd >= nextCycle.startedAt) throw new BadRequestException('Period end cannot overlap the next recorded cycle');
      cycle.periodEndedAt = nextEnd;
      cycle.periodLength = Math.floor((nextEnd.getTime() - cycle.startedAt.getTime()) / 86400000) + 1;
    } else if (updates.endDate === null || (updates.startDate && cycle.periodEndedAt && cycle.periodEndedAt < cycle.startedAt)) {
      cycle.periodEndedAt = undefined;
      cycle.periodLength = undefined;
    }
    if (updates.notes !== undefined) cycle.notes = updates.notes ?? undefined;
    await cycle.save();
    return { success: true, data: cycle, meta: { requestId: `req_${Date.now()}` } };
  }

  async startPeriod(userId: string, dateStr?: string) {
    const userObjectId = new Types.ObjectId(userId);
    const startDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();
    const dateFormatted = startDate.toISOString().split('T')[0];

    // PRD Section 13.5 Requirement: Idempotency & conflicting cycle handling
    const existingSameDay = await this.cycleModel.findOne({
      userId: userObjectId,
      startedAt: {
        $gte: new Date(`${dateFormatted}T00:00:00.000Z`),
        $lte: new Date(`${dateFormatted}T23:59:59.999Z`),
      },
    });

    if (existingSameDay) {
      return {
        success: true,
        data: { cycle: existingSameDay, message: 'Period start request was already logged (Idempotent).' },
        meta: { requestId: `req_${Date.now()}` },
      };
    }

    const latestCycle = await this.cycleModel.findOne({ userId: userObjectId, status: { $ne: 'deleted' } }).sort({ startedAt: -1 });
    if (latestCycle && startDate <= latestCycle.startedAt) {
      throw new BadRequestException('New period start must be after the most recently recorded period');
    }
    if (latestCycle && latestCycle.status === 'active') {
      latestCycle.status = 'completed';
      latestCycle.endedAt = startDate;
      latestCycle.cycleLength = Math.floor((startDate.getTime() - latestCycle.startedAt.getTime()) / 86400000);
      await latestCycle.save();
    } else if (latestCycle) {
      latestCycle.cycleLength = Math.floor((startDate.getTime() - latestCycle.startedAt.getTime()) / 86400000);
      await latestCycle.save();
    }

    const newCycle = await this.cycleModel.create({
      userId: userObjectId,
      startedAt: startDate,
      status: 'active',
      source: 'user_logged',
    });

    // Fetch user's stored cycle history for prediction engine calculation
    const history = await this.cycleModel
      .find({ userId: userObjectId, status: { $ne: 'deleted' } })
      .sort({ startedAt: -1 })
      .exec();

    const confirmedCycles = history.map((c) => ({
      periodStartDate: c.startedAt.toISOString().split('T')[0],
      periodEndDate: c.endedAt ? c.endedAt.toISOString().split('T')[0] : undefined,
    }));

    const prediction = calculateCyclePrediction({
      userId,
      confirmedCycles,
    });

    return {
      success: true,
      data: {
        cycle: newCycle,
        prediction,
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async endPeriod(userId: string, dateStr?: string) {
    const userObjectId = new Types.ObjectId(userId);
    const endDate = dateStr ? new Date(`${dateStr}T00:00:00.000Z`) : new Date();

    const activeCycle = await this.cycleModel.findOne({ userId: userObjectId, status: 'active' });
    if (!activeCycle) {
      throw new NotFoundException('No active cycle found to end period');
    }

    const start = activeCycle.startedAt.getTime();
    const end = endDate.getTime();
    if (endDate < new Date(`${activeCycle.startedAt.toISOString().slice(0, 10)}T00:00:00.000Z`)) {
      throw new BadRequestException('Period end date cannot be before its start date');
    }
    const nextCycle = await this.cycleModel.findOne({ userId: userObjectId, status: { $ne: 'deleted' }, startedAt: { $gt: activeCycle.startedAt } }).sort({ startedAt: 1 });
    if (nextCycle && endDate >= nextCycle.startedAt) {
      throw new BadRequestException('Period end date cannot overlap the next recorded cycle');
    }
    const periodLength = Math.floor((end - start) / 86400000) + 1;

    activeCycle.periodEndedAt = endDate;
    activeCycle.periodLength = periodLength;
    await activeCycle.save();

    return {
      success: true,
      data: activeCycle,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  /**
   * Encrypts a private note for storage and removes any plaintext field from
   * the same write. Called for both upsert and partial update.
   */
  private applyPrivateNote(note: unknown, set: Record<string, unknown>, unset: Record<string, ''>) {
    if (note === null || note === '') {
      for (const field of ['notes', 'notesEncrypted', 'notesIv', 'notesAuthTag', 'notesKeyId']) unset[field] = '';
      return;
    }
    if (typeof note !== 'string') return;
    if (!note.trim()) {
      for (const field of ['notes', 'notesEncrypted', 'notesIv', 'notesAuthTag', 'notesKeyId']) unset[field] = '';
      return;
    }
    const encrypted = encryptHealthNote(note);
    set.notesEncrypted = encrypted.ciphertext;
    set.notesIv = encrypted.iv;
    set.notesAuthTag = encrypted.authTag;
    set.notesKeyId = encrypted.keyId;
    unset.notes = '';
  }

  /** Decrypts an owner's note for the response and strips ciphertext fields. */
  private presentDailyLog<T extends Record<string, any>>(log: T | null): T | null {
    if (!log) return null;
    const data: Record<string, any> = { ...log };
    if (data.notesEncrypted && data.notesIv && data.notesAuthTag) {
      data.notes = decryptHealthNote({
        ciphertext: data.notesEncrypted,
        iv: data.notesIv,
        authTag: data.notesAuthTag,
        keyId: data.notesKeyId || 'default',
      });
    }
    delete data.notesEncrypted;
    delete data.notesIv;
    delete data.notesAuthTag;
    delete data.notesKeyId;
    return data as T;
  }

  async getDailyLog(userId: string, date: string) {
    const log = await this.dailyLogModel.findOne({
      userId: new Types.ObjectId(userId),
      date,
    });

    return {
      success: true,
      data: this.presentDailyLog(log ? (log.toObject() as Record<string, any>) : null) || { date, bleeding: { level: 'none' }, moods: [], symptoms: [] },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async upsertDailyLog(userId: string, date: string, payload: Record<string, unknown>) {
    const userObjectId = new Types.ObjectId(userId);
    const { notes, ...rest } = payload as Record<string, unknown> & { notes?: unknown };
    const setFields: Record<string, unknown> = { ...rest };
    const unsetFields: Record<string, ''> = {};
    if (notes !== undefined) this.applyPrivateNote(notes, setFields, unsetFields);

    const update: Record<string, any> = {
      $set: setFields,
      $setOnInsert: { userId: userObjectId, date },
      $inc: { version: 1 },
    };
    if (Object.keys(unsetFields).length) update.$unset = unsetFields;

    const log = await this.dailyLogModel.findOneAndUpdate(
      { userId: userObjectId, date },
      update,
      { new: true, upsert: true, setDefaultsOnInsert: true },
    );

    return {
      success: true,
      data: this.presentDailyLog(log ? (log.toObject() as Record<string, any>) : null),
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async patchDailyLog(userId: string, date: string, version: number, updates: Record<string, unknown>) {
    const userObjectId = new Types.ObjectId(userId);
    const setFields: Record<string, unknown> = {};
    const unsetFields: Record<string, ''> = {};
    for (const [key, value] of Object.entries(updates)) {
      if (key === 'version') continue;
      if (key === 'notes') {
        this.applyPrivateNote(value, setFields, unsetFields);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value as Record<string, unknown>)) {
          setFields[`${key}.${nestedKey}`] = nestedValue;
        }
      } else {
        setFields[key] = value;
      }
    }

    const update: Record<string, unknown> = { $set: setFields, $inc: { version: 1 } };
    if (Object.keys(unsetFields).length) update.$unset = unsetFields;
    const log = await this.dailyLogModel.findOneAndUpdate(
      { userId: userObjectId, date, version },
      update,
      { new: true, runValidators: true },
    );
    if (!log) {
      const exists = await this.dailyLogModel.exists({ userId: userObjectId, date });
      if (!exists) throw new NotFoundException('Daily log not found');
      throw new ConflictException({
        success: false,
        error: { code: 'VERSION_CONFLICT', message: 'Daily log changed since it was loaded. Reload and retry.' },
      });
    }

    return { success: true, data: this.presentDailyLog(log.toObject() as Record<string, any>), meta: { requestId: `req_${Date.now()}` } };
  }

  async deleteDailyLog(userId: string, date: string, version: number) {
    const userObjectId = new Types.ObjectId(userId);
    const log = await this.dailyLogModel.findOneAndDelete({ userId: userObjectId, date, version });
    if (!log) {
      const exists = await this.dailyLogModel.exists({ userId: userObjectId, date });
      if (!exists) throw new NotFoundException('Daily log not found');
      throw new ConflictException({
        success: false,
        error: { code: 'VERSION_CONFLICT', message: 'Daily log changed since it was loaded. Reload and retry.' },
      });
    }
    return { success: true, data: { date, deleted: true }, meta: { requestId: `req_${Date.now()}` } };
  }
}
