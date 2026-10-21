import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TriggerSosSchema, CancelSosSchema, SetSafetyPinSchema, ChangeSafetyPinSchema, GuardianCreateSchema, GuardianAcceptSchema, GuardianScopesUpdateSchema, MongoIdParam, QuietCheckInSchema, LocationSessionSchema, LocationUpdateSchema } from '../../common/validation/api-schemas';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';

@ApiTags('Safety')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('safety')
export class SafetyController {
  constructor(private readonly safetyService: SafetyService) {}

  @Get('guardians')
  @ApiOperation({ summary: 'List trusted contacts', description: 'Returns only the authenticated owner’s non-revoked guardian contacts. Pending contacts are not used for SOS alerts.' })
  @ApiResponse({ status: 200, description: 'Owner-scoped guardian contact list.' })
  async listGuardians(@Req() req: any) { return this.safetyService.listGuardians(req.user.sub); }

  @Post('guardians')
  @Idempotent()
  @ApiBody({ schema: { type: 'object', required: ['name', 'phoneE164', 'scopes'], additionalProperties: false, properties: { name: { type: 'string', minLength: 1, maxLength: 120 }, phoneE164: { type: 'string', pattern: '^\\\\+[1-9]\\\\d{7,14}$' }, scopes: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', enum: ['sos_alert', 'check_in'] } } } } })
  @ApiOperation({ summary: 'Add a pending trusted contact', description: 'Creates an invitation record. No invitation is sent and no identity verification is claimed until an approved delivery and verification flow is configured.' })
  @ApiResponse({ status: 201, description: 'Pending guardian contact; external invitation delivery is disabled.' })
  async createGuardian(@Req() req: any, @Body(new ZodValidationPipe(GuardianCreateSchema)) body) { return this.safetyService.createGuardian(req.user.sub, body); }

  @Post('guardians/accept')
  @ApiBody({ schema: { type: 'object', required: ['token'], additionalProperties: false, properties: { token: { type: 'string', minLength: 32, maxLength: 256 } } } })
  @ApiOperation({ summary: 'Accept a guardian invitation', description: 'Token is single-use and hashed at rest. Acceptance does not verify the invitee’s identity; independent verification is still required.' })
  @ApiResponse({ status: 200, description: 'Invitation accepted pending identity verification.' })
  async acceptGuardian(@Body(new ZodValidationPipe(GuardianAcceptSchema)) body) { return this.safetyService.acceptGuardianInvite(body.token); }

  @Post('guardians/:id/resend')
  @ApiParam({ name: 'id', description: '24-character guardian contact identifier.' })
  @ApiOperation({ summary: 'Re-issue a guardian invitation', description: 'Issues a fresh single-use invitation and invalidates older pending ones. Delivery is disabled until an approved channel exists, so no message is claimed to have been sent. Serial requests are throttled to one per minute per contact.' })
  @ApiResponse({ status: 201, description: 'New invitation id and expiry; delivery explicitly disabled.' })
  @ApiResponse({ status: 404, description: 'Guardian contact not found for this owner.' })
  @ApiResponse({ status: 429, description: 'An invitation was issued less than a minute ago.' })
  async resendGuardianInvite(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.safetyService.resendGuardianInvite(req.user.sub, id);
  }

  @Patch('guardians/:id/scopes')
  @ApiParam({ name: 'id', description: '24-character guardian contact identifier.' })
  @ApiOperation({ summary: 'Change a trusted contact’s scopes', description: 'Owner-only scope change between SOS alerts and quiet check-ins. Existing incidents keep the recipients they were created with.' })
  @ApiBody({ schema: { type: 'object', required: ['scopes'], additionalProperties: false, properties: { scopes: { type: 'array', minItems: 1, maxItems: 2, items: { type: 'string', enum: ['sos_alert', 'check_in'] } } } } })
  @ApiResponse({ status: 200, description: 'Updated scopes.' })
  @ApiResponse({ status: 404, description: 'Guardian contact not found for this owner.' })
  async updateGuardianScopes(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(GuardianScopesUpdateSchema)) body: { scopes: string[] },
  ) {
    return this.safetyService.updateGuardianScopes(req.user.sub, id, body.scopes);
  }

  @Delete('guardians/:id')
  @ApiParam({ name: 'id', description: '24-character guardian contact identifier.' })
  @ApiOperation({ summary: 'Revoke a trusted contact', description: 'Owner-only revocation immediately removes the contact from future SOS recipient selection.' })
  @ApiResponse({ status: 200, description: 'Guardian contact revoked.' })
  @ApiResponse({ status: 404, description: 'Guardian contact not found for this owner.' })
  async revokeGuardian(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) { return this.safetyService.revokeGuardian(req.user.sub, id); }

  @Post('check-ins')
  @ApiOperation({ summary: 'Create a quiet safety check-in', description: 'Records a private, owner-scoped check-in reminder. It does not contact emergency services or guardians.' })
  @ApiBody({ schema: { type: 'object', required: ['checkInAt', 'expiresAt'], additionalProperties: false, properties: { checkInAt: { type: 'string', format: 'date-time' }, expiresAt: { type: 'string', format: 'date-time', description: 'Maximum 24 hours after checkInAt.' } } } })
  async createQuietCheckIn(@Req() req: any, @Body(new ZodValidationPipe(QuietCheckInSchema)) body) { return this.safetyService.startQuietCheckIn(req.user.sub, body); }

  @Post('location-sessions')
  @ApiOperation({ summary: 'Start a short location-sharing session', description: 'Requires current location-sharing consent; session expires within one hour and does not dispatch SOS.' })
  @ApiBody({ schema: { type: 'object', required: ['expiresAt'], additionalProperties: false, properties: { expiresAt: { type: 'string', format: 'date-time' } } } })
  async startLocationSession(@Req() req: any, @Body(new ZodValidationPipe(LocationSessionSchema)) body) { return this.safetyService.startLocationSession(req.user.sub, body.expiresAt); }

  @Post('location-sessions/:id/updates')
  @ApiParam({ name: 'id', description: '24-character location-session identifier.' })
  @ApiBody({ schema: { type: 'object', required: ['latitude', 'longitude', 'recordedAt'], additionalProperties: false, properties: { latitude: { type: 'number', minimum: -90, maximum: 90 }, longitude: { type: 'number', minimum: -180, maximum: 180 }, recordedAt: { type: 'string', format: 'date-time' } } } })
  async updateLocationSession(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(LocationUpdateSchema)) body) { return this.safetyService.updateLocationSession(req.user.sub, id, body); }

  @Delete('location-sessions/:id')
  @ApiParam({ name: 'id', description: '24-character location-session identifier.' })
  async revokeLocationSession(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) { return this.safetyService.revokeLocationSession(req.user.sub, id); }

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
  @Idempotent()
  @ApiOperation({ summary: 'Trigger an SOS incident', description: 'Creates an SOS incident for the authenticated user. Set isTestMode=true to simulate a drill. Records a user-requested incident. No guardian delivery or emergency-services dispatch is claimed; this endpoint does not replace local emergency services.' })
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

  @Get('sos/:id/deliveries')
  @ApiParam({ name: 'id', description: '24-character SOS incident identifier.' })
  @ApiOperation({ summary: 'List recorded SOS delivery attempts', description: 'Owner-scoped delivery evidence. Attempts are only marked sent when an approved provider confirms delivery; deliveryConfirmed is false otherwise. This is not a guarantee of rescue or dispatch.' })
  @ApiResponse({ status: 200, description: 'Recorded delivery attempts and dispatch status.' })
  @ApiResponse({ status: 404, description: 'Incident not found for this account.' })
  async getSosDeliveries(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string): Promise<Record<string, unknown>> {
    return this.safetyService.getSosDeliveries(req.user.sub, id);
  }

  @Get('sos-events/:id')
  @ApiParam({ name: 'id', description: '24-character SOS incident identifier.' })
  @ApiOperation({ summary: 'Get one SOS event with delivery evidence', description: 'PRD alias for a single incident. Owner-scoped; reports deliveryConfirmed only when a provider returned evidence, and never implies emergency dispatch.' })
  @ApiResponse({ status: 200, description: 'Incident state and recorded delivery attempts.' })
  @ApiResponse({ status: 404, description: 'Incident not found for this account.' })
  async getSosEvent(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string): Promise<Record<string, unknown>> {
    return this.safetyService.getSosEvent(req.user.sub, id);
  }

  @Get('incidents')
  @ApiOperation({ summary: 'List recent SOS incidents', description: 'Returns up to 100 incidents belonging to the authenticated user, newest first.' })
  @ApiResponse({ status: 200, description: 'The user’s recent safety incidents.' })
  async getIncidents(@Req() req: any) {
    return this.safetyService.getIncidents(req.user.sub);
  }
}
