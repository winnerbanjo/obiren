import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TriggerSosSchema, CancelSosSchema, SetSafetyPinSchema, ChangeSafetyPinSchema } from '../../common/validation/api-schemas';

@ApiTags('Safety')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('safety')
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Post('pin')
  @ApiOperation({ summary: 'Create or update the Safety PIN', description: 'Sets a 4–8 digit PIN. When a PIN already exists, currentPin is required. PINs are stored as one-way hashes and never returned.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['pin'], properties: { pin: { type: 'string', pattern: '^\\d{4,8}$', format: 'password', example: '4826' }, currentPin: { type: 'string', pattern: '^\\d{4,8}$', format: 'password', description: 'Required when replacing an existing PIN.' } } } })
  @ApiResponse({ status: 201, description: 'Safety PIN created or updated.' })
  @ApiResponse({ status: 401, description: 'Current PIN is incorrect.' })
  async setSafetyPin(@Req() req: any, @Body(new ZodValidationPipe(SetSafetyPinSchema)) body) {
    return this.safetyService.setSafetyPin(req.user.sub, body);
  }

  @Post('pin/change')
  @ApiOperation({ summary: 'Change the Safety PIN', description: 'Requires the current PIN and the new 4–8 digit PIN.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['currentPin', 'newPin'], properties: { currentPin: { type: 'string', pattern: '^\\d{4,8}$', format: 'password' }, newPin: { type: 'string', pattern: '^\\d{4,8}$', format: 'password' } } } })
  @ApiResponse({ status: 201, description: 'Safety PIN changed.' })
  @ApiResponse({ status: 401, description: 'Current PIN is incorrect.' })
  async changeSafetyPin(@Req() req: any, @Body(new ZodValidationPipe(ChangeSafetyPinSchema)) body) {
    return this.safetyService.setSafetyPin(req.user.sub, { pin: body.newPin, currentPin: body.currentPin });
  }

  @Get('pin/status')
  @ApiOperation({ summary: 'Get Safety PIN status', description: 'Reports whether a PIN exists and whether verification is temporarily locked. Never returns the PIN or its hash.' })
  @ApiResponse({ status: 200, description: 'PIN configured and lockout status.' })
  async pinStatus(@Req() req: any) {
    return this.safetyService.hasSafetyPin(req.user.sub);
  }

  @Post('sos/trigger')
  @ApiOperation({ summary: 'Trigger an SOS incident', description: 'Creates an SOS incident for the authenticated user. Set isTestMode=true to simulate a drill. A live request can notify trusted-circle guardians; this endpoint does not replace local emergency services.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { isTestMode: { type: 'boolean', default: false, description: 'When true, guardian alerts are simulated.' }, gps: { type: 'string', maxLength: 120, description: 'Optional client-supplied location string.' }, notes: { type: 'string', maxLength: 1000 } } } })
  @ApiResponse({ status: 201, description: 'SOS incident created or an existing active incident returned.', content: { 'application/json': { example: { success: true, data: { incident: { id: '66a0b6f3e5f21c8e7a112233', status: 'active', isTestMode: true }, message: 'SOS test drill started. Guardian alerts are simulated in test mode.' }, meta: { requestId: 'req_1729339200000' } } } } })
  async triggerSos(@Req() req: any, @Body(new ZodValidationPipe(TriggerSosSchema)) body) {
    return this.safetyService.triggerSos(req.user.sub, body);
  }

  @Post('sos/cancel')
  @ApiOperation({ summary: 'Cancel the active SOS incident', description: 'Requires the account Safety PIN. Incorrect PIN attempts are throttled; the active incident remains live if verification fails.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['pin'], properties: { pin: { type: 'string', pattern: '^\\d{4,8}$', format: 'password' } } } })
  @ApiResponse({ status: 201, description: 'Incident cancelled after PIN verification.' })
  @ApiResponse({ status: 401, description: 'Incorrect Safety PIN.' })
  @ApiResponse({ status: 404, description: 'No active SOS incident exists.' })
  @ApiResponse({ status: 429, description: 'PIN verification is temporarily locked after repeated failures.' })
  async cancelSos(@Req() req: any, @Body(new ZodValidationPipe(CancelSosSchema)) body) {
    return this.safetyService.cancelSos(req.user.sub, body);
  }

  @Get('incidents')
  @ApiOperation({ summary: 'List recent SOS incidents', description: 'Returns up to 100 incidents belonging to the authenticated user, newest first.' })
  @ApiResponse({ status: 200, description: 'The user’s recent safety incidents.' })
  async getIncidents(@Req() req: any) {
    return this.safetyService.getIncidents(req.user.sub);
  }
}
