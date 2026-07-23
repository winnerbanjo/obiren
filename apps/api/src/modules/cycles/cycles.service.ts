import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { calculateCyclePrediction } from '@obiren/health-engine';
import { Cycle, CycleDocument, DailyLog, DailyLogDocument } from '../../database/schemas/cycle.schema';

@Injectable()
export class CyclesService {
  constructor(
    @InjectModel(Cycle.name) private cycleModel: Model<CycleDocument>,
    @InjectModel(DailyLog.name) private dailyLogModel: Model<DailyLogDocument>,
  ) {}

  async getCurrentCycle(userId: string) {
    const activeCycle = await this.cycleModel
      .findOne({ userId: new Types.ObjectId(userId), status: 'active' })
      .sort({ startedAt: -1 });

    if (!activeCycle) {
      return {
        success: true,
        data: null,
        meta: { requestId: `req_${Date.now()}` },
      };
    }

    const start = new Date(activeCycle.startedAt).getTime();
    const now = new Date().getTime();
    const dayOfCycle = Math.max(1, Math.floor((now - start) / (1000 * 60 * 60 * 24)) + 1);

    return {
      success: true,
      data: {
        id: activeCycle._id.toString(),
        userId: activeCycle.userId.toString(),
        startedAt: activeCycle.startedAt.toISOString().split('T')[0],
        dayOfCycle,
        status: activeCycle.status,
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async getCycleHistory(userId: string) {
    const cycles = await this.cycleModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ startedAt: -1 })
      .exec();

    return {
      success: true,
      data: cycles,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async startPeriod(userId: string, dateStr?: string) {
    const userObjectId = new Types.ObjectId(userId);
    const startDate = dateStr ? new Date(dateStr) : new Date();
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

    // Close any previous active cycle
    await this.cycleModel.updateMany(
      { userId: userObjectId, status: 'active' },
      { $set: { status: 'completed', endedAt: startDate } },
    );

    const newCycle = await this.cycleModel.create({
      userId: userObjectId,
      startedAt: startDate,
      status: 'active',
      source: 'user_logged',
    });

    // Fetch user's stored cycle history for prediction engine calculation
    const history = await this.cycleModel
      .find({ userId: userObjectId })
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
    const endDate = dateStr ? new Date(dateStr) : new Date();

    const activeCycle = await this.cycleModel.findOne({ userId: userObjectId, status: 'active' });
    if (!activeCycle) {
      throw new NotFoundException('No active cycle found to end period');
    }

    const start = activeCycle.startedAt.getTime();
    const end = endDate.getTime();
    const periodLength = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)));

    activeCycle.periodEndedAt = endDate;
    activeCycle.periodLength = periodLength;
    await activeCycle.save();

    return {
      success: true,
      data: activeCycle,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async getDailyLog(userId: string, date: string) {
    const log = await this.dailyLogModel.findOne({
      userId: new Types.ObjectId(userId),
      date,
    });

    return {
      success: true,
      data: log || { date, bleeding: { level: 'none' }, moods: [], symptoms: [] },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async upsertDailyLog(userId: string, date: string, payload: any) {
    const userObjectId = new Types.ObjectId(userId);
    const log = await this.dailyLogModel.findOneAndUpdate(
      { userId: userObjectId, date },
      { $set: { ...payload, userId: userObjectId, date } },
      { new: true, upsert: true },
    );

    return {
      success: true,
      data: log,
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
