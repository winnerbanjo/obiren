import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AvailabilitySlot,
  AvailabilitySlotDocument,
  Booking,
  BookingDocument,
  Clinician,
  ClinicianDocument,
  DoctorAvailabilityRule,
  DoctorAvailabilityRuleDocument,
  DoctorTimeOff,
  DoctorTimeOffDocument,
} from '../../database/schemas/care.schema';
import {
  addDaysToDateKey,
  localDateKey,
  isValidTimeZone,
  WEEKDAY_LABELS,
  zonedWallClockToUtc,
} from '../../common/time/zoned-time';

/** Bookable inventory is generated on demand; never more than this far ahead. */
export const SLOT_HORIZON_DAYS = 45;
/** A slot must start at least this long after it is generated / held. */
export const SLOT_LEAD_MINUTES = 30;

export interface GeneratedSlot {
  startsAt: Date;
  endsAt: Date;
  sessionType: string;
}

export interface ScheduleSource {
  _id: Types.ObjectId | string;
  countryCode: string;
  timeZone?: string;
  feeBySessionType?: Clinician['feeBySessionType'];
  consultationDurationMinutes?: number;
  bufferMinutes?: number;
}

/**
 * The single server-side source of truth for bookable slots.
 *
 * Both the user-facing catalogue (`GET /specialists/:id/slots`) and the Doctor
 * Portal preview call this service. Recurring weekly rules, consultation
 * duration, buffers, time off, lead time and session pricing are all applied
 * here; no client ever decides final availability.
 */
@Injectable()
export class AvailabilityService {
  constructor(
    @InjectModel(AvailabilitySlot.name) private readonly slotModel: Model<AvailabilitySlotDocument>,
    @InjectModel(DoctorAvailabilityRule.name) private readonly ruleModel: Model<DoctorAvailabilityRuleDocument>,
    @InjectModel(DoctorTimeOff.name) private readonly timeOffModel: Model<DoctorTimeOffDocument>,
    @InjectModel(Booking.name) private readonly bookingModel: Model<BookingDocument>,
  ) {}

  timeZoneFor(clinician: Pick<Clinician, 'timeZone' | 'countryCode'>): string {
    if (clinician.timeZone && isValidTimeZone(clinician.timeZone)) return clinician.timeZone;
    return clinician.countryCode === 'GB'
      ? 'Europe/London'
      : clinician.countryCode === 'US'
        ? 'America/New_York'
        : clinician.countryCode === 'GH'
          ? 'Africa/Accra'
          : 'Africa/Lagos';
  }

  /** Session types a doctor can actually sell, i.e. those with an approved price. */
  sellableSessionTypes(clinician: Pick<Clinician, 'feeBySessionType'>): string[] {
    const fees = (clinician.feeBySessionType || {}) as Record<string, number | undefined>;
    return ['clinic', 'audio', 'video', 'text'].filter((type) => Number(fees[type]) > 0);
  }

  async rulesFor(clinicianId: Types.ObjectId | string) {
    return this.ruleModel
      .find({ clinicianId: new Types.ObjectId(clinicianId), active: true })
      .sort({ dayOfWeek: 1, startMinutes: 1 })
      .lean()
      .exec();
  }

  /**
   * Materialises concrete slots for a date window. Existing rows are never
   * modified (`$setOnInsert` only), so a booked or held slot is untouched by a
   * later regeneration.
   */
  async generateSlots(
    clinician: ScheduleSource,
    from: Date,
    to: Date,
    options: { sessionTypes?: string[] } = {},
  ): Promise<number> {
    const clinicianId = new Types.ObjectId(clinician._id.toString());
    const timeZone = this.timeZoneFor(clinician);
    const duration = Math.min(Math.max(clinician.consultationDurationMinutes || 45, 10), 240);
    const buffer = Math.min(Math.max(clinician.bufferMinutes || 0, 0), 120);
    const step = duration + buffer;

    const now = Date.now();
    const earliest = new Date(now + SLOT_LEAD_MINUTES * 60_000);
    const horizon = new Date(now + SLOT_HORIZON_DAYS * 24 * 60 * 60_000);
    const windowStart = new Date(Math.max(from.getTime(), earliest.getTime()));
    const windowEnd = new Date(Math.min(to.getTime(), horizon.getTime()));
    if (windowEnd <= windowStart) return 0;

    const rules = await this.rulesFor(clinicianId);
    if (rules.length === 0) return 0;

    const sellable = new Set(options.sessionTypes?.length ? options.sessionTypes : this.sellableSessionTypes(clinician));
    const usableRules = rules.filter((rule) => sellable.has(rule.sessionType) && rule.endMinutes > rule.startMinutes);
    if (usableRules.length === 0) return 0;

    const blocked = await this.timeOffModel
      .find({ clinicianId, endsAt: { $gt: windowStart }, startsAt: { $lt: windowEnd } })
      .select('startsAt endsAt')
      .lean()
      .exec();

    const byDay = new Map<number, typeof usableRules>();
    for (const rule of usableRules) {
      const list = byDay.get(rule.dayOfWeek) ?? [];
      list.push(rule);
      byDay.set(rule.dayOfWeek, list);
    }

    const seen = new Set<number>();
    const docs: GeneratedSlot[] = [];
    const firstDate = localDateKey(windowStart, timeZone);
    const lastDate = localDateKey(windowEnd, timeZone);
    let dateKey = firstDate;
    let guard = 0;

    while (dateKey <= lastDate && guard < SLOT_HORIZON_DAYS + 2) {
      guard += 1;
      const [year, month, day] = dateKey.split('-').map(Number);
      const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
      for (const rule of byDay.get(dayOfWeek) ?? []) {
        for (let minute = rule.startMinutes; minute + duration <= rule.endMinutes; minute += step) {
          const startsAt = zonedWallClockToUtc(dateKey, minute, timeZone);
          const endsAt = new Date(startsAt.getTime() + duration * 60_000);
          if (startsAt < earliest || startsAt > windowEnd) continue;
          if (blocked.some((off) => startsAt < new Date(off.endsAt) && endsAt > new Date(off.startsAt))) continue;
          const key = startsAt.getTime();
          if (seen.has(key)) continue;
          seen.add(key);
          docs.push({ startsAt, endsAt, sessionType: rule.sessionType });
        }
      }
      dateKey = addDaysToDateKey(dateKey, 1);
    }

    if (docs.length === 0) return 0;

    const result = await this.slotModel.bulkWrite(
      docs.map((slot) => ({
        updateOne: {
          filter: { clinicianId, startsAt: slot.startsAt },
          update: {
            $setOnInsert: {
              clinicianId,
              startsAt: slot.startsAt,
              endsAt: slot.endsAt,
              sessionType: slot.sessionType,
              status: 'open',
            },
          },
          upsert: true,
        },
      })),
      { ordered: false },
    );
    return result.upsertedCount ?? 0;
  }

  /**
   * Removes only future *open* inventory. Held and booked slots are left alone
   * so a schedule change can never silently remove someone's appointment.
   */
  async clearFutureOpenSlots(clinicianId: Types.ObjectId | string): Promise<number> {
    const result = await this.slotModel.deleteMany({
      clinicianId: new Types.ObjectId(clinicianId),
      startsAt: { $gt: new Date() },
      status: 'open',
    });
    return result.deletedCount ?? 0;
  }

  /** Human-readable weekly grid for the Doctor Portal. */
  weeklyGrid(
    rules: Array<{ dayOfWeek: number; startMinutes: number; endMinutes: number; sessionType: string }>,
    timeZone: string,
    durationMinutes: number,
  ) {
    return WEEKDAY_LABELS.map((label, dayOfWeek) => ({
      dayOfWeek,
      label,
      slots: rules
        .filter((rule) => rule.dayOfWeek === dayOfWeek)
        .map((rule) => ({
          startMinutes: rule.startMinutes,
          endMinutes: rule.endMinutes,
          startTime: formatMinutes(rule.startMinutes),
          endTime: formatMinutes(rule.endMinutes),
          sessionType: rule.sessionType,
          capacity: Math.max(Math.floor((rule.endMinutes - rule.startMinutes) / Math.max(durationMinutes, 10)), 0),
        })),
      timeZone,
    }));
  }

  /** Upcoming confirmed/pending appointments that clash with a proposed block. */
  async overlappingBookings(clinicianId: Types.ObjectId | string, startsAt: Date, endsAt: Date) {
    return this.bookingModel
      .find({
        clinicianId: new Types.ObjectId(clinicianId),
        status: { $in: ['pending', 'confirmed', 'reschedule_requested'] },
        startsAt: { $lt: endsAt },
        endsAt: { $gt: startsAt },
      })
      .select('_id startsAt endsAt status sessionType userId')
      .sort({ startsAt: 1 })
      .lean()
      .exec();
  }
}

export function formatMinutes(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}
