import { Controller, Get, Post, Body, Headers, Req, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications and webhooks')
@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('webhooks/twilio/whatsapp/inbound')
  @ApiOperation({ summary: 'Twilio WhatsApp inbound webhook', description: 'Provider-to-server callback. Twilio signs the exact public request URL and form parameters; configure the public webhook URL and preserve form-encoded payloads. Not a mobile-client operation.' })
  @ApiHeader({ name: 'X-Twilio-Signature', required: true, description: 'Twilio request signature, validated against the configured account auth token.' })
  @ApiResponse({ status: 201, description: 'Inbound provider message accepted.' })
  @ApiResponse({ status: 403, description: 'Missing or invalid Twilio signature.' })
  async handleTwilioInbound(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: any,
  ) {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    return this.notificationsService.handleTwilioInbound(body, signature, fullUrl);
  }

  @Post('webhooks/twilio/whatsapp/status')
  @ApiOperation({ summary: 'Twilio WhatsApp delivery-status webhook', description: 'Provider-to-server status callback. Configure Twilio to send MessageSid and MessageStatus form fields. Not a mobile-client operation.' })
  @ApiResponse({ status: 201, description: 'Provider status accepted and mapped to the internal delivery state.' })
  async handleTwilioStatus(@Body() body: any) {
    return this.notificationsService.handleTwilioStatus(body);
  }

  @Get('internal/cron/process-notifications')
  @ApiOperation({ summary: 'Process pending notification outbox (internal)', description: 'Internal scheduler operation that atomically claims and processes up to 20 due notifications. Supply the configured secret in the X-Cron-Secret header; query-string secrets are supported for compatibility but discouraged because URLs may be logged. Not a mobile-client operation.' })
  @ApiHeader({ name: 'X-Cron-Secret', required: true, description: 'Value configured by the operator as CRON_SECRET.' })
  @ApiQuery({ name: 'cronSecret', required: false, description: 'Legacy secret transport. Prefer X-Cron-Secret header.' })
  @ApiResponse({ status: 200, description: 'Processing result, including claimedCount and processedAt.' })
  async processNotificationOutbox(@Query('cronSecret') cronSecret: string, @Headers('x-cron-secret') headerSecret: string) {
    // No fallback: without CRON_SECRET the endpoint is denied in EVERY env.
    const expected = process.env.CRON_SECRET;
    const secret = cronSecret || headerSecret;
    if (!expected || !secret || secret !== expected) {
      return { success: false, error: 'Unauthorized CRON_SECRET token' };
    }
    return this.notificationsService.processNotificationOutbox();
  }
}
