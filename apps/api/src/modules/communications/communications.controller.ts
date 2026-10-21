import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { CommunicationsService } from './communications.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { ConversationListQuerySchema, DeviceRegisterSchema, HealthShareCreateSchema, MessageCreateSchema, MessageListQuerySchema, MongoIdParam } from '../../common/validation/api-schemas';

const preferenceSchema = z.object({ inAppEnabled: z.boolean().optional(), emailEnabled: z.boolean().optional(), smsEnabled: z.boolean().optional(), discreetMode: z.boolean().optional(), disabledCategories: z.array(z.enum(['REMINDER', 'SUPPORT', 'SAFETY', 'SYSTEM'])).max(10).optional() }).strict().refine((v) => Object.keys(v).length > 0, 'Provide at least one preference');
const inboxQuery = z.object({ cursor: MongoIdParam.optional(), limit: z.coerce.number().int().min(1).max(100).default(30) }).strict();

@ApiTags('Communications')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller()
export class CommunicationsController {
  constructor(private readonly communications: CommunicationsService) {}

  @Get('consultations')
  @ApiOperation({ summary: 'List the caller’s consultations', description: 'Returns only consultations where the authenticated user is a participant. A consultation records a care relationship; it is not proof of payment or a confirmed appointment.' })
  @ApiResponse({ status: 200, description: 'Participant-scoped consultations and next cursor.' })
  async listConsultations(@Req() req: any, @Query(new ZodValidationPipe(ConversationListQuerySchema)) query) {
    return this.communications.listConsultations(req.user.sub, query.cursor, query.limit);
  }

  @Get('consultations/:id/messages')
  @ApiParam({ name: 'id', description: '24-character consultation identifier.' })
  @ApiOperation({ summary: 'List encrypted consultation messages', description: 'Participant-only. Message text is decrypted per request and never stored in plaintext. Fetching marks counterpart messages delivered; read state requires an explicit acknowledgement.' })
  @ApiResponse({ status: 200, description: 'Newest-first message page and next cursor.' })
  @ApiResponse({ status: 404, description: 'Consultation not found for this account.' })
  async listMessages(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Query(new ZodValidationPipe(MessageListQuerySchema)) query) {
    return this.communications.listMessages(req.user.sub, id, query.cursor, query.limit);
  }

  @Post('consultations/:id/messages')
  @ApiParam({ name: 'id', description: '24-character consultation identifier.' })
  @ApiBody({ schema: { type: 'object', required: ['body'], additionalProperties: false, properties: { body: { type: 'string', minLength: 1, maxLength: 4000, description: 'Plaintext message body; encrypted with AES-256-GCM at rest.' } } } })
  @ApiOperation({ summary: 'Send an encrypted consultation message', description: 'Participant-only. The body is encrypted before storage. This API records a message; it does not promise a clinician response time or emergency coverage.' })
  @ApiResponse({ status: 201, description: 'Message stored encrypted and returned decrypted to the sender.' })
  @ApiResponse({ status: 404, description: 'Consultation not found for this account.' })
  @ApiResponse({ status: 409, description: 'Consultation is closed.' })
  @ApiResponse({ status: 503, description: 'Message encryption is not configured.' })
  async postMessage(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(MessageCreateSchema)) body) {
    return this.communications.postMessage(req.user.sub, id, body.body);
  }

  @Post('consultations/:id/read')
  @ApiParam({ name: 'id', description: '24-character consultation identifier.' })
  @ApiOperation({ summary: 'Acknowledge consultation messages as read', description: 'Participant-only, client-evidenced read acknowledgement for messages sent by the other participant.' })
  @ApiResponse({ status: 201, description: 'Number of messages marked read.' })
  @ApiResponse({ status: 404, description: 'Consultation not found for this account.' })
  async acknowledgeMessages(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.communications.acknowledgeMessages(req.user.sub, id);
  }

  @Get('devices')
  @ApiOperation({ summary: 'List registered notification devices', description: 'Returns only the authenticated account’s devices. Provider tokens and token hashes are never returned.' })
  @ApiResponse({ status: 200, description: 'Owner-scoped device metadata without tokens.' })
  async listDevices(@Req() req: any) { return this.communications.listDevices(req.user.sub); }

  @Post('devices')
  @ApiBody({ schema: { type: 'object', required: ['platform', 'token'], additionalProperties: false, properties: { platform: { type: 'string', enum: ['ios', 'android', 'web'] }, token: { type: 'string', minLength: 16, maxLength: 4096, description: 'Provider push token; stored only as a hash.' }, deviceName: { type: 'string', maxLength: 80 } } } })
  @ApiOperation({ summary: 'Register a notification device', description: 'Stores a one-way hash of the provider token against the authenticated account. Registration does not confirm push delivery.' })
  @ApiResponse({ status: 201, description: 'Device registered; token is not returned.' })
  @ApiResponse({ status: 409, description: 'Token already belongs to another account.' })
  async registerDevice(@Req() req: any, @Body(new ZodValidationPipe(DeviceRegisterSchema)) body) {
    return this.communications.registerDevice(req.user.sub, body);
  }

  @Delete('devices/:id')
  @ApiParam({ name: 'id', description: '24-character device identifier.' })
  @ApiOperation({ summary: 'Revoke a notification device', description: 'Owner-only revocation. Future notifications must not target the revoked device.' })
  @ApiResponse({ status: 200, description: 'Device revoked.' })
  @ApiResponse({ status: 404, description: 'Active device not found for this account.' })
  async revokeDevice(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.communications.revokeDevice(req.user.sub, id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List private in-app notifications', description: 'Returns owner-scoped notifications. Discreet mode replaces sensitive subject/body text with neutral copy.' })
  @ApiResponse({ status: 200, description: 'Notification page and next cursor.' })
  async inbox(@Req() req: any, @Query(new ZodValidationPipe(inboxQuery)) query) { return this.communications.listInbox(req.user.sub, query.cursor, query.limit); }

  @Patch('notifications/:id/read')
  @ApiParam({ name: 'id', description: '24-character notification identifier.' })
  @ApiOperation({ summary: 'Mark a private notification as read', description: 'Only the notification owner can update read state.' })
  @ApiResponse({ status: 200, description: 'Notification marked read.' })
  @ApiResponse({ status: 404, description: 'Notification not found for this account.' })
  async markRead(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) { return this.communications.markRead(req.user.sub, id); }

  @Get('notification-preferences')
  @ApiOperation({ summary: 'Get notification preferences', description: 'Returns the authenticated user’s notification channels and discreet-mode setting.' })
  async getPreferences(@Req() req: any) { return this.communications.getPreferences(req.user.sub); }

  @Patch('notification-preferences')
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { inAppEnabled: { type: 'boolean' }, emailEnabled: { type: 'boolean' }, smsEnabled: { type: 'boolean' }, discreetMode: { type: 'boolean' }, disabledCategories: { type: 'array', maxItems: 10, items: { type: 'string', enum: ['REMINDER', 'SUPPORT', 'SAFETY', 'SYSTEM'] } } } } })
  @ApiOperation({ summary: 'Update notification preferences', description: 'Changes only the authenticated user’s preferences. Critical safety delivery remains subject to separately approved policy.' })
  @ApiResponse({ status: 200, description: 'Preferences saved.' })
  async updatePreferences(@Req() req: any, @Body(new ZodValidationPipe(preferenceSchema)) body) { return this.communications.updatePreferences(req.user.sub, body); }

  @Post('health-shares')
  @ApiOperation({ summary: 'Create an expiring health-data share', description: 'Requires current health-sharing consent and an existing recipient account. The owner chooses the scopes and evidence range; free-text notes are never included. Only a redacted snapshot within the chosen range is shared, and the share expires automatically.' })
  @ApiBody({ schema: { type: 'object', required: ['recipientUserId', 'scopes', 'from', 'to', 'expiresAt'], additionalProperties: false, properties: { recipientUserId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }, scopes: { type: 'array', minItems: 1, maxItems: 3, items: { type: 'string', enum: ['cycles', 'daily_logs', 'pregnancy'] } }, from: { type: 'string', format: 'date' }, to: { type: 'string', format: 'date' }, expiresAt: { type: 'string', format: 'date-time', description: 'Maximum 30 days from now.' } } } })
  @ApiResponse({ status: 201, description: 'Share created with scope, evidence range, and expiry.' })
  @ApiResponse({ status: 400, description: 'Invalid scopes, range, or expiry.' })
  @ApiResponse({ status: 404, description: 'Current health-sharing consent or recipient account is missing.' })
  async createHealthShare(@Req() req: any, @Body(new ZodValidationPipe(HealthShareCreateSchema)) body) { return this.communications.createHealthShare(req.user.sub, body); }

  @Get('health-shares/received')
  @ApiOperation({ summary: 'List unexpired shares received by the caller', description: 'Returns only shares addressed to the authenticated recipient that are neither expired nor revoked. The owner identity is returned as an opaque account identifier.' })
  @ApiResponse({ status: 200, description: 'Received, active shares.' })
  async getReceivedShares(@Req() req: any) { return this.communications.getReceivedShares(req.user.sub); }

  @Delete('health-shares/:id')
  @ApiParam({ name: 'id', description: '24-character health-share identifier.' })
  @ApiOperation({ summary: 'Revoke a health share', description: 'Only the sharing owner can revoke. Revocation takes effect immediately and the recipient can no longer read the snapshot.' })
  @ApiResponse({ status: 200, description: 'Share revoked.' })
  @ApiResponse({ status: 404, description: 'Active share not found for this owner.' })
  async revokeHealthShare(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) { return this.communications.revokeHealthShare(req.user.sub, id); }
}
