import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CyclesService } from './cycles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  StartPeriodSchema,
  EndPeriodSchema,
  DailyLogUpsertSchema,
  DailyLogPatchSchema,
  DailyLogVersionQuerySchema,
  DailyLogDateParam,
  CycleHistoryQuerySchema,
  CycleIdParam,
  UpdateCycleSchema,
  CreatePeriodSchema,
  UpdatePeriodSchema,
  PeriodRangeQuerySchema,
} from '../../common/validation/api-schemas';

@ApiTags('Cycles')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get the active menstrual cycle', description: 'Returns the current active cycle or `data: null` when no period has been logged. Dates use YYYY-MM-DD.' })
  @ApiResponse({ status: 200, description: 'Current cycle or null when none is active.' })
  async getCurrentCycle(@Req() req: any) {
    return this.cyclesService.getCurrentCycle(req.user.sub);
  }

  @Get('history')
  @ApiOperation({ summary: 'List cycle history', description: 'Returns this user’s recorded cycles, average observed cycle interval, data sufficiency, and a cursor for the next page. Not a contraceptive method.' })
  @ApiResponse({ status: 200, description: 'Cycle history and summary.' })
  async getCycleHistory(@Req() req: any, @Query(new ZodValidationPipe(CycleHistoryQuerySchema)) query) {
    return this.cyclesService.getCycleHistory(req.user.sub, query);
  }

  @Get('history/:id')
  @ApiOperation({ summary: 'Get cycle history detail', description: 'Returns the authenticated user’s cycle with associated daily logs and recorded flow pattern.' })
  @ApiParam({ name: 'id', description: '24-character cycle identifier.' })
  @ApiResponse({ status: 200, description: 'Cycle detail and flow pattern.' })
  @ApiResponse({ status: 404, description: 'Cycle not found for this account.' })
  async getCycleHistoryDetail(@Req() req: any, @Param('id', new ZodValidationPipe(CycleIdParam)) id: string) {
    return this.cyclesService.getCycleHistoryDetail(req.user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a recorded period', description: 'Updates the authenticated user’s period start/end dates or private note. Dates are calendar dates. Periods cannot overlap or be reordered across adjacent records.' })
  @ApiParam({ name: 'id', description: '24-character cycle identifier.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { startDate: { type: 'string', format: 'date' }, endDate: { type: 'string', format: 'date', nullable: true }, notes: { type: 'string', maxLength: 1000, nullable: true } } } })
  @ApiResponse({ status: 200, description: 'Cycle updated.' })
  @ApiResponse({ status: 400, description: 'The update creates an invalid or overlapping period.' })
  @ApiResponse({ status: 404, description: 'Cycle not found for this account.' })
  async updateCycle(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(CycleIdParam)) id: string,
    @Body(new ZodValidationPipe(UpdateCycleSchema)) body,
  ) {
    return this.cyclesService.updateCycle(req.user.sub, id, body);
  }

  @Post('start-period')
  @ApiOperation({ summary: 'Log the start of a period', description: 'Starts a cycle for the supplied calendar date, or today when omitted. Repeating the same date is idempotent; any previous active cycle is completed.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { date: { type: 'string', format: 'date', description: 'Period start date. Defaults to today.', example: '2026-10-19' } } } })
  @ApiResponse({ status: 201, description: 'Cycle logged, with cycle prediction when available.' })
  async startPeriod(@Req() req: any, @Body(new ZodValidationPipe(StartPeriodSchema)) body) {
    return this.cyclesService.startPeriod(req.user.sub, body.date);
  }

  @Post('end-period')
  @ApiOperation({ summary: 'Log the end of a period', description: 'Ends the active period on the supplied date, or today when omitted.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { date: { type: 'string', format: 'date', description: 'Period end date. Defaults to today.', example: '2026-10-23' } } } })
  @ApiResponse({ status: 201, description: 'Active cycle updated with period end information.' })
  @ApiResponse({ status: 404, description: 'No active cycle exists.' })
  async endPeriod(@Req() req: any, @Body(new ZodValidationPipe(EndPeriodSchema)) body) {
    return this.cyclesService.endPeriod(req.user.sub, body.date);
  }
}

@ApiTags('Periods')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('periods')
export class PeriodsController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get()
  @ApiOperation({
    summary: 'List recorded periods in a date range',
    description: 'Returns the authenticated user’s recorded periods that overlap the inclusive range, oldest first, with the average recorded period length. Dates are YYYY-MM-DD. No prediction or contraceptive claim is returned.',
  })
  @ApiResponse({ status: 200, description: 'Recorded periods and duration summary.' })
  async listPeriods(@Req() req: any, @Query(new ZodValidationPipe(PeriodRangeQuerySchema)) query: { from: string; to: string }) {
    return this.cyclesService.listPeriods(req.user.sub, query.from, query.to);
  }

  @Post()
  @ApiOperation({
    summary: 'Record a period',
    description: 'Records a period start date (defaults to today in the account timezone) and optional end date. Repeating the same start date is idempotent; a start date before the latest recorded period is rejected rather than rewriting history.',
  })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { startDate: { type: 'string', format: 'date', description: 'Period start date. Defaults to today in the account timezone.' }, endDate: { type: 'string', format: 'date', nullable: true, description: 'Optional last bleeding day; at most 31 days after the start.' }, notes: { type: 'string', maxLength: 1000, nullable: true } } } })
  @ApiResponse({ status: 201, description: 'Period recorded, or the existing record for that start date.' })
  @ApiResponse({ status: 400, description: 'Dates are invalid, overlap the next period, or fall before the latest recorded period.' })
  async createPeriod(@Req() req: any, @Body(new ZodValidationPipe(CreatePeriodSchema)) body) {
    return this.cyclesService.createPeriod(req.user.sub, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit a recorded period', description: 'Owner-scoped update of the period start/end dates or private note. Periods cannot overlap or be reordered across adjacent records.' })
  @ApiParam({ name: 'id', description: '24-character period identifier.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { startDate: { type: 'string', format: 'date' }, endDate: { type: 'string', format: 'date', nullable: true }, notes: { type: 'string', maxLength: 1000, nullable: true } } } })
  @ApiResponse({ status: 200, description: 'Period updated.' })
  @ApiResponse({ status: 400, description: 'The update creates an invalid or overlapping period.' })
  @ApiResponse({ status: 404, description: 'Period not found for this account.' })
  async updatePeriod(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(CycleIdParam)) id: string,
    @Body(new ZodValidationPipe(UpdatePeriodSchema)) body,
  ) {
    return this.cyclesService.updatePeriod(req.user.sub, id, body);
  }
}

@ApiTags('Daily logs')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('daily-logs')
export class DailyLogsController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get(':date')
  @ApiOperation({ summary: 'Get a daily health log', description: 'Returns the log for a calendar date. If no log exists, returns a default empty log for that date.' })
  @ApiParam({ name: 'date', description: 'Calendar date in YYYY-MM-DD format.', example: '2026-10-19' })
  @ApiResponse({ status: 200, description: 'Daily log or default empty log.' })
  async getDailyLog(
    @Req() req: any,
    @Param('date', new ZodValidationPipe(DailyLogDateParam)) date: string,
  ) {
    return this.cyclesService.getDailyLog(req.user.sub, date);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Create or replace a daily health log', description: 'Upserts the authenticated user’s log for the date. Omitted mood and symptom lists default to empty arrays; provide the complete desired value for each included field. The response includes a version for subsequent conditional edits.' })
  @ApiParam({ name: 'date', description: 'Calendar date in YYYY-MM-DD format.', example: '2026-10-19' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { mode: { type: 'string', enum: ['cycle', 'pregnancy', 'postpartum', 'general'], description: 'Tracking experience for this entry.' }, bleeding: { type: 'object', additionalProperties: false, properties: { level: { type: 'string', enum: ['none', 'spotting', 'light', 'medium', 'heavy'] }, clots: { type: 'boolean' } } }, bloodColor: { type: 'string', enum: ['pink', 'light_red', 'red', 'dark_red', 'brown'] }, pain: { type: 'object', additionalProperties: false, properties: { level: { type: 'integer', minimum: 0, maximum: 10 }, locations: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 40 } } } }, moods: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 40 } }, symptoms: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 40 } }, energy: { type: 'integer', minimum: 1, maximum: 5 }, cravings: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 40 } }, sleep: { type: 'object', additionalProperties: false, properties: { hours: { type: 'number', minimum: 0, maximum: 24 }, quality: { type: 'string', enum: ['poor', 'fair', 'good', 'great'] } } }, sexualActivity: { type: 'object', additionalProperties: false, properties: { occurred: { type: 'boolean' }, protection: { type: 'string', maxLength: 40 } } }, notes: { type: 'string', maxLength: 2000 } } } })
  @ApiResponse({ status: 200, description: 'Saved daily log.' })
  async upsertDailyLog(
    @Req() req: any,
    @Param('date', new ZodValidationPipe(DailyLogDateParam)) date: string,
    @Body(new ZodValidationPipe(DailyLogUpsertSchema)) body,
  ) {
    return this.cyclesService.upsertDailyLog(req.user.sub, date, body);
  }

  @Patch(':date')
  @ApiOperation({ summary: 'Partially update a daily health log', description: 'Changes only supplied fields and nested properties. Include the current version returned by GET/PUT; stale writes receive 409 VERSION_CONFLICT.' })
  @ApiParam({ name: 'date', description: 'Calendar date in YYYY-MM-DD format.', example: '2026-10-19' })
  @ApiBody({ schema: { type: 'object', required: ['version'], additionalProperties: false, properties: { version: { type: 'integer', minimum: 1 }, mode: { type: 'string', enum: ['cycle', 'pregnancy', 'postpartum', 'general'] }, bleeding: { type: 'object', additionalProperties: false, properties: { level: { type: 'string', enum: ['none', 'spotting', 'light', 'medium', 'heavy'] }, clots: { type: 'boolean' } } }, bloodColor: { type: 'string', enum: ['pink', 'light_red', 'red', 'dark_red', 'brown'], nullable: true }, pain: { type: 'object', additionalProperties: false, properties: { level: { type: 'integer', minimum: 0, maximum: 10 }, locations: { type: 'array', maxItems: 12, items: { type: 'string', maxLength: 40 } } } }, energy: { type: 'integer', minimum: 1, maximum: 5, nullable: true }, cravings: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 40 } }, sleep: { type: 'object', additionalProperties: false, nullable: true, properties: { hours: { type: 'number', minimum: 0, maximum: 24 }, quality: { type: 'string', enum: ['poor', 'fair', 'good', 'great'] } } }, moods: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 40 } }, symptoms: { type: 'array', maxItems: 30, items: { type: 'string', maxLength: 40 } }, sexualActivity: { type: 'object', additionalProperties: false, properties: { occurred: { type: 'boolean' }, protection: { type: 'string', maxLength: 40 } } }, notes: { type: 'string', maxLength: 2000, nullable: true } } } })
  @ApiResponse({ status: 200, description: 'Daily log updated.' })
  @ApiResponse({ status: 404, description: 'Daily log not found for this account.' })
  @ApiResponse({ status: 409, description: 'The supplied version is stale.' })
  async patchDailyLog(
    @Req() req: any,
    @Param('date', new ZodValidationPipe(DailyLogDateParam)) date: string,
    @Body(new ZodValidationPipe(DailyLogPatchSchema)) body,
  ) {
    const { version, ...updates } = body;
    return this.cyclesService.patchDailyLog(req.user.sub, date, version, updates);
  }

  @Delete(':date')
  @ApiOperation({ summary: 'Delete a daily health log', description: 'Deletes only the authenticated user’s log when the supplied version matches the current record.' })
  @ApiParam({ name: 'date', description: 'Calendar date in YYYY-MM-DD format.', example: '2026-10-19' })
  @ApiResponse({ status: 200, description: 'Daily log deleted.' })
  @ApiResponse({ status: 404, description: 'Daily log not found for this account.' })
  @ApiResponse({ status: 409, description: 'The supplied version is stale.' })
  async deleteDailyLog(
    @Req() req: any,
    @Param('date', new ZodValidationPipe(DailyLogDateParam)) date: string,
    @Query(new ZodValidationPipe(DailyLogVersionQuerySchema)) query,
  ) {
    return this.cyclesService.deleteDailyLog(req.user.sub, date, query.version);
  }
}
