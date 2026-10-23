import { Controller, Get, Post, Body, Headers, Req, Query, UnauthorizedException } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { NotificationsService } from './notifications.service';
import { assertCronSecret } from '../../common/auth/cron-secret';

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
  async handleTwilioStatus(@Body() body: any, @Headers('x-twilio-signature') signature: string, @Req() req: any) {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    if (!this.notificationsService.verifyTwilioSignature(signature, fullUrl, body)) {
      throw new UnauthorizedException('Invalid Twilio status webhook signature');
    }
    return this.notificationsService.handleTwilioStatus(body);
  }

  @Get('internal/cron/process-notifications')
  @ApiOperation({ summary: 'Process pending notification outbox (internal)', description: 'Internal scheduler operation that atomically claims and processes up to 20 due notifications. Authenticates with X-Cron-Secret, Authorization: Bearer <CRON_SECRET> (Vercel Cron), or the legacy query parameter. Denied when CRON_SECRET is unset. Not a mobile-client operation.' })
  @ApiHeader({ name: 'X-Cron-Secret', required: false, description: 'Value configured by the operator as CRON_SECRET. `Authorization: Bearer <CRON_SECRET>` is also accepted.' })
  @ApiQuery({ name: 'cronSecret', required: false, description: 'Legacy secret transport. Prefer X-Cron-Secret or a Bearer header.' })
  @ApiResponse({ status: 200, description: 'Processing result, including claimedCount and processedAt.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid cron credential.' })
  async processNotificationOutbox(
    @Query('cronSecret') cronSecret: string,
    @Headers('x-cron-secret') headerSecret: string,
    @Headers('authorization') authorization: string,
  ) {
    // No fallback: without CRON_SECRET the endpoint is denied in EVERY env.
    assertCronSecret({ headerSecret, querySecret: cronSecret, authorization });
    return this.notificationsService.processNotificationOutbox();
  }
}
