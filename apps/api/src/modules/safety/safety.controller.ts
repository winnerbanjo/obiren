import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SafetyService } from './safety.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TriggerSosSchema, CancelSosSchema, SetSafetyPinSchema, ChangeSafetyPinSchema } from '../../common/validation/api-schemas';

@UseGuards(JwtAuthGuard)
@Controller('safety')
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('pin')
  async setSafetyPin(@Req() req: any, @Body(new ZodValidationPipe(SetSafetyPinSchema)) body) {
    return this.safetyService.setSafetyPin(req.user.sub, body);
  }

  @Post('pin/change')
  async changeSafetyPin(@Req() req: any, @Body(new ZodValidationPipe(ChangeSafetyPinSchema)) body) {
    return this.safetyService.setSafetyPin(req.user.sub, { pin: body.newPin, currentPin: body.currentPin });
  }

  @Get('pin/status')
  async pinStatus(@Req() req: any) {
    return this.safetyService.hasSafetyPin(req.user.sub);
  }

  @Post('sos/trigger')
  async triggerSos(@Req() req: any, @Body(new ZodValidationPipe(TriggerSosSchema)) body) {
    return this.safetyService.triggerSos(req.user.sub, body);
  }

  @Post('sos/cancel')
  async cancelSos(@Req() req: any, @Body(new ZodValidationPipe(CancelSosSchema)) body) {
    return this.safetyService.cancelSos(req.user.sub, body);
  }

  @Get('incidents')
  async getIncidents(@Req() req: any) {
    return this.safetyService.getIncidents(req.user.sub);
  }
}
