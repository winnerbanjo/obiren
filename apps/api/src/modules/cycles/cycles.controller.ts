import { Controller, Get, Post, Put, Body, Param, Req, UseGuards } from '@nestjs/common';
import { CyclesService } from './cycles.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cycles')
export class CyclesController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get('current')
  async getCurrentCycle(@Req() req: any) {
    return this.cyclesService.getCurrentCycle(req.user.sub);
  }

  @Get('history')
  async getCycleHistory(@Req() req: any) {
    return this.cyclesService.getCycleHistory(req.user.sub);
  }

  @Post('start-period')
  async startPeriod(@Req() req: any, @Body() body: any) {
    return this.cyclesService.startPeriod(req.user.sub, body.date);
  }

  @Post('end-period')
  async endPeriod(@Req() req: any, @Body() body: any) {
    return this.cyclesService.endPeriod(req.user.sub, body.date);
  }
}

@UseGuards(JwtAuthGuard)
@Controller('daily-logs')
export class DailyLogsController {
  constructor(private readonly cyclesService: CyclesService) {}

  @Get(':date')
  async getDailyLog(@Req() req: any, @Param('date') date: string) {
    return this.cyclesService.getDailyLog(req.user.sub, date);
  }

  @Put(':date')
  async upsertDailyLog(@Req() req: any, @Param('date') date: string, @Body() body: any) {
    return this.cyclesService.upsertDailyLog(req.user.sub, date, body);
  }
}
