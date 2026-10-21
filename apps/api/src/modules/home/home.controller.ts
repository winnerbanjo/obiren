import { BadRequestException, Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CyclesService } from '../cycles/cycles.service';
import { DailyLog, DailyLogDocument } from '../../database/schemas/cycle.schema';
import { PregnancyLog, PregnancyLogDocument } from '../../database/schemas/pregnancy.schema';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PregnancyService } from '../pregnancy/pregnancy.service';
import { HomeQuerySchema } from '../../common/validation/api-schemas';
import { daysBetween, todayInZone } from '../../common/time/local-date';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date must be a valid YYYY-MM-DD calendar date');
const rangeSchema = z.object({ from: date, to: date }).strict()
  .refine((range) => range.from <= range.to, 'from must be on or before to')
  .refine((range) => (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86400000 <= 92, 'Date range cannot exceed 93 days');

/** Projection that keeps free-text notes and ciphertext out of calendar/home reads. */
const LOG_PROJECTION = '-notes -notesEncrypted -notesIv -notesAuthTag -notesKeyId -userId';

@ApiTags('Home')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller()
export class HomeController {
  constructor(
    @InjectModel(DailyLog.name) private readonly dailyLogModel: Model<DailyLogDocument>,
    @InjectModel(PregnancyLog.name) private readonly pregnancyLogModel: Model<PregnancyLogDocument>,
    private readonly cyclesService: CyclesService,
    private readonly pregnancyService: PregnancyService,
  ) {}

  /**
   * PRD `GET /home?date=`. Every value below is derived from persisted data for
   * the authenticated account; nothing is a design placeholder and no value is
   * a diagnosis. Cycle dates remain estimates and are never contraceptive advice.
   */
  @Get('home')
  @ApiOperation({
    summary: 'Get the authenticated-user home summary',
    description: 'Aggregates persisted current-cycle, pregnancy, and recent-log state for a local calendar date. Free-text notes are never returned. Predictions are estimates, not medical or contraceptive advice.',
  })
  @ApiQuery({ name: 'date', required: false, description: 'Local calendar date in YYYY-MM-DD. Defaults to today in the account timezone.' })
  @ApiResponse({ status: 200, description: 'Persisted home summary for the bearer-token owner.' })
  @ApiResponse({ status: 400, description: 'The supplied date is not a valid calendar date.' })
  async getHome(@Req() req: any, @Query(new ZodValidationPipe(HomeQuerySchema)) query: { date?: string }): Promise<Record<string, unknown>> {
    const userId = new Types.ObjectId(req.user.sub);
    const timeZone = await this.cyclesService.timeZoneFor(req.user.sub);
    const today = todayInZone(timeZone);
    const viewDate = query.date ?? today;

    // Future days have no persisted activity; refuse rather than invent state.
    if (viewDate > today) throw new BadRequestException('date cannot be later than today in the account timezone');

    const [cycleResponse, pregnancyResponse, todayLog, recentLogs, pregnancyLog] = await Promise.all([
      this.cyclesService.getCurrentCycle(req.user.sub),
      this.pregnancyService.getCurrentPregnancy(req.user.sub),
      this.dailyLogModel.findOne({ userId, date: viewDate }).select(LOG_PROJECTION).lean().exec(),
      this.dailyLogModel.find({ userId }).sort({ date: -1 }).limit(30).select(LOG_PROJECTION).lean().exec(),
      this.pregnancyLogModel.findOne({ userId, date: viewDate }).select(LOG_PROJECTION).lean().exec(),
    ]);

    const storedCycle = cycleResponse.data as Record<string, any> | null;
    // `/home?date=` is a day view: the cycle-day figure must describe the
    // requested date, never the wall-clock day.
    const cycle: Record<string, any> | null = storedCycle
      ? {
          ...storedCycle,
          dayOfCycle: viewDate >= storedCycle.startedAt ? daysBetween(storedCycle.startedAt, viewDate) + 1 : null,
          asOfDate: viewDate,
        }
      : null;
    const pregnancy = pregnancyResponse.data as Record<string, any> | null;
    const logs = recentLogs.map(({ _id, ...log }) => ({ ...log, id: _id.toString(), mode: log.mode || 'cycle' }));

    const cards: Array<Record<string, unknown>> = [];
    if (!todayLog) {
      cards.push({
        id: 'daily-log',
        type: 'daily_log',
        title: 'Log how you feel today',
        body: 'Record bleeding, pain, mood and energy. Only you can see it.',
        action: { method: 'PUT', path: `/daily-logs/${viewDate}` },
      });
    }
    if (cycle && !cycle.periodEndedAt) {
      cards.push({
        id: 'period-end',
        type: 'period_end',
        title: 'Period still open',
        body: 'Add an end date when your bleeding stops so your history stays accurate.',
        action: { method: 'PATCH', path: `/periods/${cycle.id}` },
      });
    }
    if (pregnancy && !pregnancyLog) {
      cards.push({
        id: 'pregnancy-check-in',
        type: 'pregnancy_check_in',
        title: 'Pregnancy check-in',
        body: 'Record symptoms, hydration and how you are feeling.',
        action: { method: 'PUT', path: `/pregnancy-logs/${viewDate}` },
      });
    }

    const insights: Array<Record<string, unknown>> = [];
    if (!cycle) {
      insights.push({
        code: 'NO_CYCLE_RECORDED',
        message: 'Record a period start to see a cycle-day estimate.',
      });
    } else if (cycle.prediction?.confidence === 'LOW') {
      insights.push({
        code: 'MORE_CYCLE_DATA_NEEDED',
        message: 'Record a few more periods for a more personalised estimate.',
      });
    }

    return {
      success: true,
      data: {
        date: viewDate,
        timeZone,
        cycle,
        pregnancy,
        todayLog: todayLog ? { ...todayLog, id: todayLog._id.toString(), mode: todayLog.mode || 'cycle' } : null,
        recentLogs: logs.slice(0, 7),
        pulse: {
          date: viewDate,
          cycleDay: cycle?.dayOfCycle ?? null,
          loggedToday: Boolean(todayLog),
          loggedDayStreak: this.streak(logs, viewDate),
          lastLoggedDate: logs[0]?.date ?? null,
        },
        cards,
        insights,
        disclaimer: 'Cycle dates and pregnancy milestones are estimates and not a contraceptive method or medical advice.',
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  /** Consecutive logged days ending on `date` (0 when today has no entry). */
  private streak(logs: Array<{ date: string }>, date: string): number {
    let cursor = date;
    let count = 0;
    for (const log of logs) {
      if (log.date === cursor) {
        count += 1;
        const previous = new Date(Date.parse(`${cursor}T00:00:00Z`) - 86400000).toISOString().slice(0, 10);
        cursor = previous;
      } else if (log.date < cursor) {
        break;
      }
    }
    return count;
  }

  @Get('daily-logs')
  @ApiOperation({ summary: 'List daily logs for a calendar range', description: 'Returns only the authenticated user’s logs, ordered by local calendar date. Free-text notes are omitted from this calendar response.' })
  @ApiQuery({ name: 'from', required: true, description: 'Inclusive local calendar date (YYYY-MM-DD).' })
  @ApiQuery({ name: 'to', required: true, description: 'Inclusive local calendar date (YYYY-MM-DD); range maximum 93 days.' })
  @ApiResponse({ status: 200, description: 'Calendar log entries; notes are omitted.' })
  async getCalendar(@Req() req: any, @Query(new ZodValidationPipe(rangeSchema)) query: z.infer<typeof rangeSchema>): Promise<Record<string, unknown>> {
    const logs = await this.dailyLogModel.find({
      userId: new Types.ObjectId(req.user.sub),
      date: { $gte: query.from, $lte: query.to },
    }).sort({ date: 1 }).select(LOG_PROJECTION).lean().exec();
    return {
      success: true,
      data: {
        from: query.from,
        to: query.to,
        logs: logs.map((log) => ({
          ...log,
          id: log._id.toString(),
          mode: log.mode || 'cycle',
          // Calendar markers so a client can render periods without a second call.
          isPeriodDay: (log.bleeding?.level || 'none') !== 'none',
        })),
        summary: {
          loggedDayCount: logs.length,
          periodDayCount: logs.filter((log) => (log.bleeding?.level || 'none') !== 'none').length,
          spanDays: daysBetween(query.from, query.to) + 1,
        },
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
