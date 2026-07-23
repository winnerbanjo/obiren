import { Controller, Get, Post, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { PregnancyService } from './pregnancy.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('pregnancies')
export class PregnancyController {
  constructor(private readonly pregnancyService: PregnancyService) {}

  @Get('current')
  async getCurrentPregnancy(@Req() req: any) {
    return this.pregnancyService.getCurrentPregnancy(req.user.sub);
  }

  @Post()
  async createPregnancy(@Req() req: any, @Body() body: any) {
    return this.pregnancyService.createPregnancy(req.user.sub, body);
  }

  @Post(':id/end')
  async endPregnancy(@Req() req: any, @Param('id') id: string, @Body() body: any) {
    return this.pregnancyService.endPregnancy(req.user.sub, id, body.reason);
  }

  @Put(':id/logs/:date')
  async logSymptom(@Req() req: any, @Param('id') id: string, @Param('date') date: string, @Body() body: any) {
    return this.pregnancyService.logSymptomWithSafetyEscalation(req.user.sub, id, date, body);
  }
}
