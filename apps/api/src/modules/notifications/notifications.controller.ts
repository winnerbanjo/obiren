import { Controller, Get, Post, Body, Headers, Req, Query } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

@Controller()
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('webhooks/twilio/whatsapp/inbound')
  async handleTwilioInbound(
    @Body() body: any,
    @Headers('x-twilio-signature') signature: string,
    @Req() req: any,
  ) {
    const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
    return this.notificationsService.handleTwilioInbound(body, signature, fullUrl);
  }

  @Post('webhooks/twilio/whatsapp/status')
  async handleTwilioStatus(@Body() body: any) {
    return this.notificationsService.handleTwilioStatus(body);
  }

  @Get('internal/cron/process-notifications')
  async processNotificationOutbox(@Query('cronSecret') cronSecret: string, @Headers('x-cron-secret') headerSecret: string) {
    const expected = process.env.CRON_SECRET || 'obiren_cron_security_bearer_token_32b';
    const secret = cronSecret || headerSecret;
    if (secret !== expected && process.env.NODE_ENV === 'production') {
      return { success: false, error: 'Unauthorized CRON_SECRET token' };
    }
    return this.notificationsService.processNotificationOutbox();
  }
}
