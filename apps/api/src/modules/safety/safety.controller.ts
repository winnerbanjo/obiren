import { Controller, Get, Post, Body, Req, UseGuards } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('safety')
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('sos/trigger')
  async triggerSos(@Req() req: any, @Body() body: any) {
    return this.safetyService.triggerSos(req.user.sub, body);
  }

  @Post('sos/cancel')
  async cancelSos(@Req() req: any, @Body() body: any) {
    return this.safetyService.cancelSos(req.user.sub, body);
  }

  @Get('incidents')
  async getIncidents(@Req() req: any) {
    return this.safetyService.getIncidents(req.user.sub);
  }
}
