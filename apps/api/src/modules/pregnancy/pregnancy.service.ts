import { BadRequestException, ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Pregnancy, PregnancyDocument, PregnancyLog, PregnancyLogDocument } from '../../database/schemas/pregnancy.schema';
import { UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { decryptHealthNote, encryptHealthNote } from '../../common/crypto/health-data-crypto';

@Injectable()
export class PregnancyService {
  constructor(
    @InjectModel(Pregnancy.name) private pregnancyModel: Model<PregnancyDocument>,
    @InjectModel(PregnancyLog.name) private pregnancyLogModel: Model<PregnancyLogDocument>,
    @InjectModel(UserProfile.name) private userProfileModel: Model<UserProfileDocument>,
  ) {}

  private calculateGestationalAge(lmpDate: Date) {
    const days = Math.max(0, Math.floor((Date.now() - lmpDate.getTime()) / 86400000));
    const currentWeek = Math.floor(days / 7) + 1;
    const currentDay = (days % 7) + 1;
    let fruitSize = 'Poppy Seed 🌱';
    let lengthCm = 0.2;
    let weightGrams = 1;
    if (currentWeek >= 22) { fruitSize = 'Papaya 🥭'; lengthCm = 27.8; weightGrams = 430; }
    else if (currentWeek >= 16) { fruitSize = 'Avocado 🥑'; lengthCm = 11.6; weightGrams = 100; }
    else if (currentWeek >= 12) { fruitSize = 'Lime 🍋'; lengthCm = 5.4; weightGrams = 14; }
    return { currentWeek, currentDay, fruitSize, lengthCm, weightGrams };
  }

  async getCurrentPregnancy(userId: string) {
    const active = await this.pregnancyModel.findOne({ userId: new Types.ObjectId(userId), status: 'active' });
    if (!active) return { success: true, data: null, meta: { requestId: `req_${Date.now()}` } };
    const dueDate = active.clinicianConfirmedDueDate || active.estimatedDueDate;
    const unknownDating = active.dateConfidence === 'unknown';
    const lmp = active.lastMenstrualPeriod || (unknownDating ? undefined : new Date(dueDate.getTime() - 280 * 86400000));
    const gestation = lmp ? this.calculateGestationalAge(lmp) : null;
    return {
      success: true,
      data: {
        id: active._id.toString(), status: active.status,
        estimatedDueDate: dueDate.toISOString().slice(0, 10),
        clinicianConfirmedDueDate: active.clinicianConfirmedDueDate?.toISOString().slice(0, 10) ?? null,
        dueDateSource: active.clinicianDueDateSource || active.calculationSource,
        dateConfidence: active.dateConfidence, timeZone: active.timeZone,
        lastMenstrualPeriod: lmp?.toISOString().slice(0, 10) ?? null,
        currentWeek: gestation?.currentWeek ?? null, currentDay: gestation?.currentDay ?? null,
        babyMilestone: gestation ? { fruitSize: gestation.fruitSize, lengthCm: gestation.lengthCm, weightGrams: gestation.weightGrams } : null,
        nextMilestones: active.timelineEvents || [],
        disclaimer: 'Pregnancy dates and milestones are estimates, not a diagnosis or substitute for clinician advice.',
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async createPregnancy(userId: string, dto: { lastMenstrualPeriod?: string; estimatedDueDate?: string; calculationSource?: string; dateConfidence: string; multiplePregnancy: boolean }) {
    const userObjectId = new Types.ObjectId(userId);
    if (await this.pregnancyModel.exists({ userId: userObjectId, status: 'active' })) {
      throw new BadRequestException('User already has an active pregnancy profile. End or archive the active pregnancy first.');
    }
    const lmp = dto.lastMenstrualPeriod ? new Date(`${dto.lastMenstrualPeriod}T00:00:00.000Z`) : undefined;
    const dueDate = dto.estimatedDueDate ? new Date(`${dto.estimatedDueDate}T00:00:00.000Z`) : new Date(lmp!.getTime() + 280 * 86400000);
    const source = dto.calculationSource || (lmp ? 'last_menstrual_period' : 'user_entered');
    if (source !== 'last_menstrual_period' && !dto.estimatedDueDate) throw new BadRequestException('An estimated due date is required for the selected date source');
    const profile = await this.userProfileModel.findOne({ userId: userObjectId }).select('timeZone').lean();
    const pregnancy = await this.pregnancyModel.create({
      userId: userObjectId, status: 'active', estimatedDueDate: dueDate, lastMenstrualPeriod: lmp,
      calculationSource: source, dateConfidence: dto.dateConfidence, multiplePregnancy: dto.multiplePregnancy,
      timeZone: profile?.timeZone || 'Africa/Lagos',
      timelineEvents: [{ type: 'pregnancy_created', date: new Date() }],
    });
    return { success: true, data: pregnancy, meta: { requestId: `req_${Date.now()}` } };
  }

  async endPregnancy(userId: string, id: string, reason: string) {
    const pregnancy = await this.pregnancyModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) });
    if (!pregnancy) throw new NotFoundException('Pregnancy record not found');
    if (pregnancy.status !== 'active') throw new ConflictException('Pregnancy is already ended');
    pregnancy.status = reason;
    pregnancy.endReason = reason;
    pregnancy.endedAt = new Date();
    pregnancy.timelineEvents.push({ type: `pregnancy_${reason}`, date: pregnancy.endedAt });
    pregnancy.version += 1;
    await pregnancy.save();
    return { success: true, data: pregnancy, meta: { requestId: `req_${Date.now()}` } };
  }

  async logSymptomWithSafetyEscalation(userId: string, id: string, date: string, payload: Record<string, unknown>) {
    const pregnancy = await this.pregnancyModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), status: 'active' });
    if (!pregnancy) throw new NotFoundException('Active pregnancy record not found for this account.');
    const symptoms = Array.isArray(payload.symptoms) ? payload.symptoms as string[] : [];
    const highRisk = symptoms.some((symptom) => ['severe_bleeding', 'severe_abdominal_pain', 'vision_loss', 'reduced_fetal_movement', 'absent_fetal_movement'].includes(symptom.toLowerCase()));
    const safetyNotice = highRisk ? {
      severity: 'urgent', title: 'Please seek urgent medical advice',
      message: 'This symptom may require urgent clinical assessment at a hospital emergency department.',
      actions: [{ type: 'directory', label: 'Find maternity emergency care' }, { type: 'emergency', label: 'View emergency contacts (112 / 999 / 911)' }],
    } : null;

    const logData: Record<string, unknown> = {
      ...payload, userId: pregnancy.userId, pregnancyId: pregnancy._id, date, timeZone: pregnancy.timeZone,
      symptoms, vitamins: payload.vitamins ?? [], nutrition: payload.nutrition ?? [], selfCare: payload.selfCare ?? [],
      fetalMovement: payload.fetalMovement || 'not_assessed',
    };
    const note = payload.notes;
    delete logData.notes;
    if (typeof note === 'string' && note.length > 0) {
      const encrypted = encryptHealthNote(note);
      logData.notesEncrypted = encrypted.ciphertext;
      logData.notesIv = encrypted.iv;
      logData.notesAuthTag = encrypted.authTag;
      logData.notesKeyId = encrypted.keyId;
    } else if (note === null || note === '') {
      logData.notesEncrypted = undefined;
      logData.notesIv = undefined;
      logData.notesAuthTag = undefined;
      logData.notesKeyId = undefined;
    }
    const log = await this.pregnancyLogModel.findOneAndUpdate(
      { pregnancyId: pregnancy._id, date },
      { $set: logData, $inc: { version: 1 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: false },
    ).exec();
    const responseLog = log.toObject() as unknown as Record<string, unknown>;
    if (log.notesEncrypted && log.notesIv && log.notesAuthTag) {
      responseLog.notes = decryptHealthNote({ ciphertext: log.notesEncrypted, iv: log.notesIv, authTag: log.notesAuthTag, keyId: log.notesKeyId || 'default' });
    }
    delete responseLog.notesEncrypted; delete responseLog.notesIv; delete responseLog.notesAuthTag; delete responseLog.notesKeyId;
    return { success: true, data: { pregnancyId: id, loggedAt: date, log: responseLog, safetyNotice }, meta: { requestId: `req_${Date.now()}` } };
  }

  async getPregnancyLog(userId: string, date: string) {
    const pregnancy = await this.pregnancyModel.findOne({ userId: new Types.ObjectId(userId), status: 'active' }).select('_id').lean().exec();
    if (!pregnancy) return { success: true, data: { date, symptoms: [], vitamins: [], nutrition: [], selfCare: [], fetalMovement: 'not_assessed', version: 0 }, meta: { requestId: `req_${Date.now()}` } };
    const log = await this.pregnancyLogModel.findOne({ pregnancyId: pregnancy._id, userId: new Types.ObjectId(userId), date }).lean().exec();
    if (!log) return { success: true, data: { date, symptoms: [], vitamins: [], nutrition: [], selfCare: [], fetalMovement: 'not_assessed', version: 0 }, meta: { requestId: `req_${Date.now()}` } };
    const data: Record<string, unknown> = { ...log };
    if (log.notesEncrypted && log.notesIv && log.notesAuthTag) data.notes = decryptHealthNote({ ciphertext: log.notesEncrypted, iv: log.notesIv, authTag: log.notesAuthTag, keyId: log.notesKeyId || 'default' });
    delete data.notesEncrypted; delete data.notesIv; delete data.notesAuthTag; delete data.notesKeyId;
    return { success: true, data, meta: { requestId: `req_${Date.now()}` } };
  }

  async getTimeline(userId: string, id: string) {
    const pregnancy = await this.pregnancyModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).lean().exec();
    if (!pregnancy) throw new NotFoundException('Pregnancy record not found');
    return { success: true, data: { pregnancyId: id, events: pregnancy.timelineEvents || [], estimatedDueDate: pregnancy.clinicianConfirmedDueDate || pregnancy.estimatedDueDate }, meta: { requestId: `req_${Date.now()}` } };
  }

  async updatePregnancy(userId: string, id: string, updates: Record<string, unknown>) {
    const pregnancy = await this.pregnancyModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) });
    if (!pregnancy) throw new NotFoundException('Pregnancy record not found');
    if (pregnancy.status !== 'active') throw new ConflictException('Only an active pregnancy can be updated');
    if (updates.lastMenstrualPeriod === null) {
      pregnancy.lastMenstrualPeriod = undefined;
      pregnancy.calculationSource = String(updates.calculationSource || 'user_entered');
      if (updates.calculationSource === 'user_entered' && updates.dateConfidence === undefined) pregnancy.dateConfidence = 'unknown';
    } else if (typeof updates.lastMenstrualPeriod === 'string') {
      const nextLmp = new Date(`${updates.lastMenstrualPeriod}T00:00:00.000Z`);
      if (!updates.calculationSource || updates.calculationSource === 'last_menstrual_period') {
        const nextEdd = new Date(nextLmp.getTime() + 280 * 86400000);
        pregnancy.dueDateHistory.push({ previousDate: pregnancy.clinicianConfirmedDueDate || pregnancy.estimatedDueDate, nextDate: nextEdd, source: 'last_menstrual_period', recordedAt: new Date() });
        pregnancy.estimatedDueDate = nextEdd;
        pregnancy.clinicianConfirmedDueDate = undefined;
        pregnancy.clinicianDueDateSource = undefined;
      }
      pregnancy.lastMenstrualPeriod = nextLmp;
      pregnancy.calculationSource = String(updates.calculationSource || 'last_menstrual_period');
    }
    if (typeof updates.estimatedDueDate === 'string') {
      if (updates.calculationSource === 'last_menstrual_period' && !pregnancy.lastMenstrualPeriod) {
        throw new BadRequestException('lastMenstrualPeriod is required when calculationSource is last_menstrual_period');
      }
      const nextDate = new Date(`${updates.estimatedDueDate}T00:00:00.000Z`);
      const source = String(updates.calculationSource || 'user_entered');
      pregnancy.dueDateHistory.push({ previousDate: pregnancy.clinicianConfirmedDueDate || pregnancy.estimatedDueDate, nextDate, source, recordedAt: new Date() });
      pregnancy.estimatedDueDate = nextDate;
      if (updates.lastMenstrualPeriod === null) pregnancy.lastMenstrualPeriod = undefined;
      // Client-submitted provenance is informative only. Never elevate a user
      // assertion into clinician-confirmed dating.
      pregnancy.clinicianConfirmedDueDate = undefined;
      pregnancy.clinicianDueDateSource = undefined;
      pregnancy.calculationSource = source;
    }
    if (typeof updates.calculationSource === 'string') pregnancy.calculationSource = updates.calculationSource;
    if (typeof updates.dateConfidence === 'string') pregnancy.dateConfidence = updates.dateConfidence;
    else if (typeof updates.estimatedDueDate === 'string' || typeof updates.lastMenstrualPeriod === 'string') pregnancy.dateConfidence = 'approximate';
    if (typeof updates.multiplePregnancy === 'boolean') pregnancy.multiplePregnancy = updates.multiplePregnancy;
    pregnancy.version += 1;
    pregnancy.timelineEvents.push({ type: 'pregnancy_updated', date: new Date(), details: 'Dating or profile information updated by the account owner.' });
    await pregnancy.save();
    return { success: true, data: pregnancy, meta: { requestId: `req_${Date.now()}` } };
  }

  async recordKickSession(userId: string, id: string, session: { startedAt: string; completedAt: string; count: number }) {
    const pregnancy = await this.pregnancyModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), status: 'active' });
    if (!pregnancy) throw new NotFoundException('Active pregnancy record not found');
    if (pregnancy.dateConfidence === 'unknown') throw new UnprocessableEntityException('Kick counting requires a known pregnancy date; ask a clinician about appropriate tracking.');
    const dueDate = pregnancy.clinicianConfirmedDueDate || pregnancy.estimatedDueDate;
    const lmp = pregnancy.lastMenstrualPeriod || new Date(dueDate.getTime() - 280 * 86400000);
    if (this.calculateGestationalAge(lmp).currentWeek < 28) throw new UnprocessableEntityException('Kick-count tracking is not enabled before 28 weeks; follow clinician guidance.');
    const startedAt = new Date(session.startedAt); const completedAt = new Date(session.completedAt);
    pregnancy.kickSessions.push({ startedAt, completedAt, count: session.count, durationMinutes: Math.round((completedAt.getTime() - startedAt.getTime()) / 60000) });
    pregnancy.version += 1;
    await pregnancy.save();
    return { success: true, data: { pregnancyId: id, session: pregnancy.kickSessions[pregnancy.kickSessions.length - 1] }, meta: { requestId: `req_${Date.now()}` } };
  }

  async getKickSessions(userId: string, id: string) {
    const pregnancy = await this.pregnancyModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId) }).select('kickSessions').lean().exec();
    if (!pregnancy) throw new NotFoundException('Pregnancy record not found');
    return { success: true, data: pregnancy.kickSessions || [], meta: { requestId: `req_${Date.now()}` } };
  }

  async updateWellness(userId: string, id: string, date: string, updates: Record<string, unknown>) {
    const pregnancy = await this.pregnancyModel.findOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), status: 'active' });
    if (!pregnancy) throw new NotFoundException('Active pregnancy record not found');
    const set: Record<string, unknown> = { ...updates, userId: pregnancy.userId, pregnancyId: pregnancy._id, date, timeZone: pregnancy.timeZone };
    const log = await this.pregnancyLogModel.findOneAndUpdate(
      { pregnancyId: pregnancy._id, date },
      { $set: set, $setOnInsert: { symptoms: [], vitamins: [], nutrition: [], selfCare: [], fetalMovement: 'not_assessed' }, $inc: { version: 1 } },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: false },
    ).exec();
    return { success: true, data: log, meta: { requestId: `req_${Date.now()}` } };
  }

  async getPregnancyHistory(userId: string, query: { cursor?: string; limit: number }) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.pregnancyModel.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean().exec();
    const hasNext = rows.length > query.limit;
    const pregnancies = rows.slice(0, query.limit);
    return { success: true, data: { pregnancies, nextCursor: hasNext ? pregnancies[pregnancies.length - 1]._id.toString() : null }, meta: { requestId: `req_${Date.now()}` } };
  }
}
