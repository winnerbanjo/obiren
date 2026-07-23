import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pregnancy, PregnancyDocument } from '../../database/schemas/pregnancy.schema';

@Injectable()
export class PregnancyService {
  constructor(@InjectModel(Pregnancy.name) private pregnancyModel: Model<PregnancyDocument>) {}

  private calculateGestationalAge(lmpDate: Date) {
    const lmpTime = lmpDate.getTime();
    const nowTime = new Date().getTime();
    const diffDays = Math.max(0, Math.floor((nowTime - lmpTime) / (1000 * 60 * 60 * 24)));

    const currentWeek = Math.floor(diffDays / 7) + 1;
    const currentDay = (diffDays % 7) + 1;

    // Fruit size milestone map based on gestational week
    let fruitSize = 'Poppy Seed 🌱';
    let lengthCm = 0.2;
    let weightGrams = 1;

    if (currentWeek >= 22) {
      fruitSize = 'Papaya 🥭';
      lengthCm = 27.8;
      weightGrams = 430;
    } else if (currentWeek >= 16) {
      fruitSize = 'Avocado 🥑';
      lengthCm = 11.6;
      weightGrams = 100;
    } else if (currentWeek >= 12) {
      fruitSize = 'Lime 🍋';
      lengthCm = 5.4;
      weightGrams = 14;
    }

    return { currentWeek, currentDay, fruitSize, lengthCm, weightGrams };
  }

  async getCurrentPregnancy(userId: string) {
    const active = await this.pregnancyModel.findOne({
      userId: new Types.ObjectId(userId),
      status: 'active',
    });

    if (!active) {
      return {
        success: true,
        data: null,
        meta: { requestId: `req_${Date.now()}` },
      };
    }

    const lmp = active.lastMenstrualPeriod || new Date(active.estimatedDueDate.getTime() - 280 * 24 * 60 * 60 * 1000);
    const milestone = this.calculateGestationalAge(lmp);

    return {
      success: true,
      data: {
        id: active._id.toString(),
        userId: active.userId.toString(),
        status: active.status,
        estimatedDueDate: active.estimatedDueDate.toISOString().split('T')[0],
        lastMenstrualPeriod: lmp.toISOString().split('T')[0],
        calculationSource: active.calculationSource,
        currentWeek: milestone.currentWeek,
        currentDay: milestone.currentDay,
        babyMilestone: {
          fruitSize: milestone.fruitSize,
          lengthCm: milestone.lengthCm,
          weightGrams: milestone.weightGrams,
        },
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async createPregnancy(userId: string, dto: any) {
    const userObjectId = new Types.ObjectId(userId);

    // PRD Section 15 Requirement: Only ONE active pregnancy allowed per user
    const existingActive = await this.pregnancyModel.findOne({ userId: userObjectId, status: 'active' });
    if (existingActive) {
      throw new BadRequestException('User already has an active pregnancy profile. End or archive the active pregnancy first.');
    }

    let lmp = dto.lastMenstrualPeriod ? new Date(dto.lastMenstrualPeriod) : new Date();
    let dueDate = dto.estimatedDueDate ? new Date(dto.estimatedDueDate) : new Date(lmp.getTime() + 280 * 24 * 60 * 60 * 1000);

    const pregnancy = await this.pregnancyModel.create({
      userId: userObjectId,
      status: 'active',
      estimatedDueDate: dueDate,
      lastMenstrualPeriod: lmp,
      calculationSource: dto.calculationSource || 'last_menstrual_period',
    });

    return {
      success: true,
      data: pregnancy,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async endPregnancy(userId: string, id: string, reason: string) {
    const pregnancy = await this.pregnancyModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!pregnancy) {
      throw new NotFoundException('Pregnancy record not found');
    }

    pregnancy.status = reason || 'completed';
    pregnancy.endedAt = new Date();
    await pregnancy.save();

    return {
      success: true,
      data: pregnancy,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async logSymptomWithSafetyEscalation(userId: string, id: string, date: string, payload: any) {
    const pregnancy = await this.pregnancyModel.findOne({
      _id: new Types.ObjectId(id),
      userId: new Types.ObjectId(userId),
    });

    if (!pregnancy) {
      throw new NotFoundException('Pregnancy record not found or access denied.');
    }

    const isHighRisk = payload.symptoms?.some((s: string) =>
      ['severe_bleeding', 'severe_abdominal_pain', 'vision_loss', 'reduced_fetal_movement'].includes(s.toLowerCase())
    );

    let safetyNotice = null;
    if (isHighRisk) {
      safetyNotice = {
        severity: 'urgent',
        title: 'Please seek urgent medical advice',
        message: 'This symptom may require urgent clinical assessment at a hospital emergency department.',
        actions: [
          { type: 'directory', label: 'Find maternity emergency care' },
          { type: 'emergency', label: 'View emergency contacts (112 / 999 / 911)' },
        ],
      };
    }

    return {
      success: true,
      data: {
        pregnancyId: id,
        loggedAt: date,
        payload,
        safetyNotice,
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
