import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PregnancyService } from './pregnancy.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CreatePregnancySchema,
  EndPregnancySchema,
  PregnancyLogSchema,
  PregnancyHistoryQuerySchema,
  PregnancyWellnessSchema,
  UpdatePregnancySchema,
  KickCountSchema,
  MongoIdParam,
  PregnancyLogDateParam,
} from '../../common/validation/api-schemas';

@ApiTags('Pregnancy')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('pregnancies')
export class PregnancyController {
  constructor(private readonly pregnancyService: PregnancyService) {}

  @Get('current')
  @ApiOperation({ summary: 'Get the active pregnancy', description: 'Returns the current pregnancy with estimated gestational age and milestone, or `data: null` when no active pregnancy exists.' })
  @ApiResponse({ status: 200, description: 'Active pregnancy or null.' })
  async getCurrentPregnancy(@Req() req: any) {
    return this.pregnancyService.getCurrentPregnancy(req.user.sub);
  }

  @Get('active')
  @ApiOperation({ summary: 'Get the active pregnancy (PRD alias)', description: 'Alias of `GET /pregnancies/current`. Returns the current pregnancy with trimester, gestational age and milestone, or `data: null` when no active pregnancy exists.' })
  @ApiResponse({ status: 200, description: 'Active pregnancy or null.' })
  async getActivePregnancy(@Req() req: any) {
    return this.pregnancyService.getCurrentPregnancy(req.user.sub);
  }

  @Get('history')
  @ApiOperation({ summary: 'List pregnancy history', description: 'Returns the authenticated user’s pregnancy records, newest first, using cursor pagination.' })
  @ApiResponse({ status: 200, description: 'Pregnancy history and next cursor.' })
  async getPregnancyHistory(@Req() req: any, @Query(new ZodValidationPipe(PregnancyHistoryQuerySchema)) query) {
    return this.pregnancyService.getPregnancyHistory(req.user.sub, query);
  }

  @Get('logs/:date')
  @ApiOperation({ summary: 'Get the pregnancy check-in for a date', description: 'Returns the authenticated user’s saved pregnancy log or a default empty log for the date.' })
  @ApiParam({ name: 'date', description: 'Local calendar date in YYYY-MM-DD format.' })
  @ApiResponse({ status: 200, description: 'Saved check-in or default empty check-in.' })
  async getPregnancyLog(@Req() req: any, @Param('date', new ZodValidationPipe(PregnancyLogDateParam)) date: string) {
    return this.pregnancyService.getPregnancyLog(req.user.sub, date);
  }

  @Post()
  @ApiOperation({ summary: 'Create a pregnancy profile', description: 'Provide either lastMenstrualPeriod or estimatedDueDate. Only one active pregnancy is allowed per account. Dates use YYYY-MM-DD.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { lastMenstrualPeriod: { type: 'string', format: 'date', example: '2026-08-01' }, estimatedDueDate: { type: 'string', format: 'date', example: '2027-05-08' }, calculationSource: { type: 'string', enum: ['last_menstrual_period', 'ultrasound', 'medical_professional', 'user_entered'], default: 'last_menstrual_period' }, multiplePregnancy: { type: 'boolean', default: false } }, description: 'At least one of lastMenstrualPeriod or estimatedDueDate is required.' } })
  @ApiResponse({ status: 201, description: 'Pregnancy profile created.' })
  @ApiResponse({ status: 400, description: 'Neither date provided, or an active pregnancy already exists.' })
  async createPregnancy(@Req() req: any, @Body(new ZodValidationPipe(CreatePregnancySchema)) body) {
    return this.pregnancyService.createPregnancy(req.user.sub, body);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update active pregnancy dating and profile fields', description: 'Owner-scoped update. An owner-entered due date is recorded as an estimate and is not marked clinician-confirmed.' })
  @ApiParam({ name: 'id', description: '24-character pregnancy identifier.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { lastMenstrualPeriod: { type: 'string', format: 'date', nullable: true }, estimatedDueDate: { type: 'string', format: 'date' }, calculationSource: { type: 'string', enum: ['last_menstrual_period', 'ultrasound', 'user_entered'] }, dateConfidence: { type: 'string', enum: ['certain', 'approximate', 'unknown'] }, multiplePregnancy: { type: 'boolean' } } } })
  @ApiResponse({ status: 200, description: 'Pregnancy updated with dating provenance.' })
  @ApiResponse({ status: 404, description: 'Pregnancy not found for this account.' })
  @ApiResponse({ status: 409, description: 'Pregnancy is no longer active.' })
  async updatePregnancy(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(UpdatePregnancySchema)) body) {
    return this.pregnancyService.updatePregnancy(req.user.sub, id, body);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Get pregnancy timeline', description: 'Returns owner-scoped recorded pregnancy events and due-date estimate. No unreviewed medical advice is generated.' })
  @ApiParam({ name: 'id', description: '24-character pregnancy identifier.' })
  @ApiResponse({ status: 200, description: 'Pregnancy timeline.' })
  @ApiResponse({ status: 404, description: 'Pregnancy not found for this account.' })
  async getTimeline(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.pregnancyService.getTimeline(req.user.sub, id);
  }

  @Post(':id/kicks')
  @ApiOperation({ summary: 'Record a fetal movement count session', description: 'Owner-scoped. Tracking is blocked before 28 gestational weeks; this is a logging feature, not reassurance or medical advice.' })
  @ApiParam({ name: 'id', description: '24-character pregnancy identifier.' })
  @ApiBody({ schema: { type: 'object', required: ['startedAt', 'completedAt', 'count'], additionalProperties: false, properties: { startedAt: { type: 'string', format: 'date-time' }, completedAt: { type: 'string', format: 'date-time' }, count: { type: 'integer', minimum: 1, maximum: 100 } } } })
  @ApiResponse({ status: 201, description: 'Kick-count session recorded.' })
  @ApiResponse({ status: 422, description: 'Kick counting is not enabled before 28 weeks.' })
  async recordKickSession(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(KickCountSchema)) body) {
    return this.pregnancyService.recordKickSession(req.user.sub, id, body);
  }

  @Get(':id/kicks')
  @ApiOperation({ summary: 'List fetal movement count sessions', description: 'Returns the authenticated user’s recorded sessions.' })
  @ApiParam({ name: 'id', description: '24-character pregnancy identifier.' })
  @ApiResponse({ status: 200, description: 'Kick-count sessions.' })
  async getKickSessions(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.pregnancyService.getKickSessions(req.user.sub, id);
  }

  @Patch(':id/wellness/:date')
  @ApiOperation({ summary: 'Update pregnancy wellness counts', description: 'Updates only supplied water or vitamin values for a local calendar date; does not overwrite symptom fields.' })
  @ApiParam({ name: 'id', description: '24-character pregnancy identifier.' })
  @ApiParam({ name: 'date', description: 'Local calendar date in YYYY-MM-DD format.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { water: { type: 'integer', minimum: 0, maximum: 30 }, vitamins: { type: 'array', maxItems: 20, items: { type: 'string', minLength: 1, maxLength: 60 } } } } })
  @ApiResponse({ status: 200, description: 'Wellness fields saved.' })
  @ApiResponse({ status: 404, description: 'Active pregnancy not found for this account.' })
  async updateWellness(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Param('date', new ZodValidationPipe(PregnancyLogDateParam)) date: string, @Body(new ZodValidationPipe(PregnancyWellnessSchema)) body) {
    return this.pregnancyService.updateWellness(req.user.sub, id, date, body);
  }

  @Post(':id/end')
  @ApiOperation({ summary: 'End or archive a pregnancy profile', description: 'Records the outcome and ends the pregnancy. Valid reasons are completed, loss, terminated, or archived.' })
  @ApiParam({ name: 'id', description: '24-character pregnancy identifier.', example: '66a0b6f3e5f21c8e7a112233' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['reason'], properties: { reason: { type: 'string', enum: ['completed', 'loss', 'terminated', 'archived'] } } } })
  @ApiResponse({ status: 201, description: 'Pregnancy profile ended.' })
  @ApiResponse({ status: 409, description: 'Pregnancy has already ended.' })
  @ApiResponse({ status: 404, description: 'Pregnancy not found for this account.' })
  async endPregnancy(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(EndPregnancySchema)) body,
  ) {
    return this.pregnancyService.endPregnancy(req.user.sub, id, body.reason);
  }

  @Put(':id/logs/:date')
  @ApiOperation({ summary: 'Log pregnancy check-in', description: 'Upserts the authenticated user’s structured pregnancy check-in for a local date. Free-text notes are encrypted at rest. Selected high-risk symptom labels return an urgent safety notice; this API is not an emergency service.' })
  @ApiParam({ name: 'id', description: '24-character pregnancy identifier.', example: '66a0b6f3e5f21c8e7a112233' })
  @ApiParam({ name: 'date', description: 'Calendar date in YYYY-MM-DD format.', example: '2026-10-19' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { nausea: { type: 'string', enum: ['none', 'mild', 'moderate', 'severe'] }, symptoms: { type: 'array', maxItems: 30, items: { type: 'string', minLength: 1, maxLength: 60 }, default: [] }, mood: { type: 'string', maxLength: 40 }, energy: { type: 'string', maxLength: 40 }, water: { type: 'integer', minimum: 0, maximum: 30 }, vitamins: { type: 'array', maxItems: 20, items: { type: 'string' } }, nutrition: { type: 'array', maxItems: 30, items: { type: 'string' } }, selfCare: { type: 'array', maxItems: 30, items: { type: 'string' } }, notes: { type: 'string', maxLength: 2000, nullable: true }, fetalMovement: { type: 'string', enum: ['normal', 'reduced', 'absent', 'not_assessed'], default: 'not_assessed' } } } })
  @ApiResponse({ status: 200, description: 'Pregnancy check-in saved; may include an urgent safetyNotice.' })
  @ApiResponse({ status: 503, description: 'Sensitive-note encryption is not configured.' })
  @ApiResponse({ status: 404, description: 'Pregnancy not found for this account.' })
  async logSymptom(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Param('date', new ZodValidationPipe(PregnancyLogDateParam)) date: string,
    @Body(new ZodValidationPipe(PregnancyLogSchema)) body,
  ) {
    return this.pregnancyService.logSymptomWithSafetyEscalation(req.user.sub, id, date, body);
  }
}

/**
 * PRD date-keyed pregnancy check-in routes. The active pregnancy is resolved
 * server-side so a client never has to send (or guess) a pregnancy id.
 */
@ApiTags('Pregnancy')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('pregnancy-logs')
export class PregnancyLogsController {
  constructor(private readonly pregnancyService: PregnancyService) {}

  @Get(':date')
  @ApiOperation({ summary: 'Get the pregnancy check-in for a date', description: 'Returns the active pregnancy check-in for a local calendar date, or a default empty check-in. Free-text notes are decrypted only for the owner.' })
  @ApiParam({ name: 'date', description: 'Local calendar date in YYYY-MM-DD format.' })
  @ApiResponse({ status: 200, description: 'Saved check-in or default empty check-in.' })
  async getLog(@Req() req: any, @Param('date', new ZodValidationPipe(PregnancyLogDateParam)) date: string) {
    return this.pregnancyService.getPregnancyLog(req.user.sub, date);
  }

  @Put(':date')
  @ApiOperation({ summary: 'Log a pregnancy check-in for a date', description: 'Upserts the structured check-in for the active pregnancy on a local calendar date. Free-text notes are encrypted at rest; selected high-risk symptom labels return an urgent safety notice. This API is not an emergency service.' })
  @ApiParam({ name: 'date', description: 'Local calendar date in YYYY-MM-DD format.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { nausea: { type: 'string', enum: ['none', 'mild', 'moderate', 'severe'] }, symptoms: { type: 'array', maxItems: 30, items: { type: 'string', minLength: 1, maxLength: 60 } }, mood: { type: 'string', maxLength: 40 }, energy: { type: 'string', maxLength: 40 }, water: { type: 'integer', minimum: 0, maximum: 30 }, vitamins: { type: 'array', maxItems: 20, items: { type: 'string' } }, nutrition: { type: 'array', maxItems: 30, items: { type: 'string' } }, selfCare: { type: 'array', maxItems: 30, items: { type: 'string' } }, fetalMovement: { type: 'string', enum: ['normal', 'reduced', 'absent', 'not_assessed'] }, notes: { type: 'string', maxLength: 2000, nullable: true } } } })
  @ApiResponse({ status: 200, description: 'Check-in saved; may include an urgent safetyNotice.' })
  @ApiResponse({ status: 404, description: 'No active pregnancy for this account.' })
  async putLog(@Req() req: any, @Param('date', new ZodValidationPipe(PregnancyLogDateParam)) date: string, @Body(new ZodValidationPipe(PregnancyLogSchema)) body) {
    const pregnancyId = await this.pregnancyService.requireActivePregnancyId(req.user.sub);
    return this.pregnancyService.logSymptomWithSafetyEscalation(req.user.sub, pregnancyId, date, body);
  }
}
