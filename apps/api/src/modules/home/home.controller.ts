import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CyclesService } from '../cycles/cycles.service';
import { DailyLog, DailyLogDocument } from '../../database/schemas/cycle.schema';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { PregnancyService } from '../pregnancy/pregnancy.service';

const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine((value) => {
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}, 'Date must be a valid YYYY-MM-DD calendar date');
const rangeSchema = z.object({ from: date, to: date }).strict()
  .refine((range) => range.from <= range.to, 'from must be on or before to')
  .refine((range) => (Date.parse(`${range.to}T00:00:00Z`) - Date.parse(`${range.from}T00:00:00Z`)) / 86400000 <= 92, 'Date range cannot exceed 93 days');

@ApiTags('Home')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller()
export class HomeController {
  constructor(
    @InjectModel(DailyLog.name) private readonly dailyLogModel: Model<DailyLogDocument>,
    private readonly cyclesService: CyclesService,
    private readonly pregnancyService: PregnancyService,
  ) {}

  @Get('home')
  @ApiOperation({ summary: 'Get authenticated-user home summary', description: 'Aggregates persisted current-cycle, pregnancy, and recent-log state. Dates and predictions are estimates, not medical advice.' })
  @ApiResponse({ status: 200, description: 'Persisted home summary for the bearer-token owner.' })
  async getHome(@Req() req: any): Promise<Record<string, unknown>> {
    const userId = new Types.ObjectId(req.user.sub);
    const [cycleResponse, pregnancyResponse, recentLogs] = await Promise.all([
      this.cyclesService.getCurrentCycle(req.user.sub),
      this.pregnancyService.getCurrentPregnancy(req.user.sub),
      this.dailyLogModel.find({ userId }).sort({ date: -1 }).limit(7).select('-notes -notesEncrypted -notesIv -notesAuthTag -notesKeyId -userId').lean().exec(),
    ]);
    return {
      success: true,
      data: {
        cycle: cycleResponse.data,
        pregnancy: pregnancyResponse.data,
        recentLogs: recentLogs.map(({ _id, ...log }) => ({ ...log, id: _id.toString() })),
      },
      meta: { requestId: `req_${Date.now()}` },
    };
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
    }).sort({ date: 1 }).select('-notes -notesEncrypted -notesIv -notesAuthTag -notesKeyId -userId').lean().exec();
    return {
      success: true,
      data: { from: query.from, to: query.to, logs },
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
