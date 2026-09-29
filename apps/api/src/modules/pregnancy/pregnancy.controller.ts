import { Body, Controller, Get, Param, Post, Put, Req, UseGuards } from '@nestjs/common';
import { PregnancyService } from './pregnancy.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  CreatePregnancySchema,
  EndPregnancySchema,
  PregnancySymptomLogSchema,
  MongoIdParam,
  DailyLogDateParam,
} from '../../common/validation/api-schemas';

@UseGuards(JwtAuthGuard)
@Controller('pregnancies')
export class PregnancyController {
  constructor(private readonly pregnancyService: PregnancyService) {}

  @Get('current')
  async getCurrentPregnancy(@Req() req: any) {
    return this.pregnancyService.getCurrentPregnancy(req.user.sub);
  }

  @Post()
  async createPregnancy(@Req() req: any, @Body(new ZodValidationPipe(CreatePregnancySchema)) body) {
    return this.pregnancyService.createPregnancy(req.user.sub, body);
  }

  @Post(':id/end')
  async endPregnancy(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(EndPregnancySchema)) body,
  ) {
    return this.pregnancyService.endPregnancy(req.user.sub, id, body.reason);
  }

  @Put(':id/logs/:date')
  async logSymptom(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Param('date', new ZodValidationPipe(DailyLogDateParam)) date: string,
    @Body(new ZodValidationPipe(PregnancySymptomLogSchema)) body,
  ) {
    return this.pregnancyService.logSymptomWithSafetyEscalation(req.user.sub, id, date, body);
  }
}
