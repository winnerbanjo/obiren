import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { WaitlistService } from './waitlist.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { WaitlistSignupSchema } from '../../common/validation/api-schemas';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Waitlist')
@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  /** Public signup - stricter rate limit (10 per minute per IP) and validated. */
  @Post()
  @ApiOperation({ summary: 'Join the early-access waitlist', description: 'Public, rate-limited signup (10 requests per minute per IP). Duplicate emails receive the same response shape as new signups to prevent account enumeration.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['email'], properties: { email: { type: 'string', format: 'email', maxLength: 320, example: 'maya@example.com' }, firstName: { type: 'string', maxLength: 80 }, source: { type: 'string', maxLength: 60, default: 'web' }, market: { type: 'string', maxLength: 60 }, referral: { type: 'string', maxLength: 120 } } } })
  @ApiResponse({ status: 201, description: 'Signup accepted; response indicates whether the email was already on the list.' })
  @ApiResponse({ status: 429, description: 'Rate limit exceeded.' })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async join(@Body(new ZodValidationPipe(WaitlistSignupSchema)) body) {
    return this.waitlistService.join(body);
  }

  @Get()
  @ApiOperation({ summary: 'Get public waitlist totals', description: 'Returns aggregate signup count only; no personal information is exposed.' })
  @ApiResponse({ status: 200, description: 'Aggregate waitlist count.' })
  async stats() {
    return this.waitlistService.stats();
  }

  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'platform_admin')
  @Get('entries')
  @ApiOperation({ summary: 'List waitlist entries (admin)', description: 'Privileged operational endpoint for paginated waitlist entries. Requires a bearer token with super_admin or platform_admin role; not intended for mobile clients.' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based page number (default 1).', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Page size (default 50; maximum 200).', example: 50 })
  @ApiResponse({ status: 200, description: 'Paginated waitlist entries.' })
  @ApiResponse({ status: 403, description: 'Administrative role required.' })
  async list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.waitlistService.list(Number(page) || 1, Math.min(Number(limit) || 50, 200));
  }

  /**
   * Draft view of captured waitlist emails (HTML or ?format=json).
   * In production it only answers to the private list key (shared with the
   * password-gated /waitlist/list page). The JWT-guarded /entries endpoint
   * remains the real audit surface.
   */
  @Get('preview')
  @ApiOperation({ summary: 'Waitlist preview (operator-only)', description: 'Development preview returning HTML by default or JSON with format=json. In production requires the private X-List-Key header. Use the role-protected /waitlist/entries API for normal admin access; this route is not for mobile clients.' })
  @ApiQuery({ name: 'format', required: false, enum: ['json'], description: 'Return JSON instead of the default HTML preview.' })
  @ApiHeader({ name: 'X-List-Key', required: false, description: 'Required in production; value is configured by the operator.' })
  @ApiResponse({ status: 200, description: 'Waitlist preview in requested format.' })
  @ApiResponse({ status: 404, description: 'Preview is not available to this caller.' })
  async preview(@Query('format') format?: string, @Req() req?: Request, @Res() res?: Response) {
    const listKey = process.env.WAITLIST_LIST_PASSWORD;
    const authorized =
      process.env.NODE_ENV !== 'production' ||
      (!!listKey && req?.headers?.['x-list-key'] === listKey);
    if (!authorized) {
      return res!.status(404).send('Not found');
    }
    const { data } = await this.waitlistService.list(1, 200);
    if (format === 'json') {
      return res!.type('json').send({ success: true, data });
    }

    const esc = (s: unknown) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    const rows = data.entries
      .map((e: any, i: number) => {
        const position = data.total - i;
        const joined = e.createdAt ? new Date(e.createdAt).toISOString().replace('T', ' ').slice(0, 16) + ' UTC' : '-';
        return `<tr><td class="pos">#${position}</td><td class="email">${esc(e.email)}</td><td>${esc(e.firstName || '-')}</td><td><span class="pill">${esc(e.source)}</span></td><td>${esc(e.market || '-')}</td><td><span class="status s-${esc(e.status)}">${esc(e.status)}</span></td><td class="dim">${joined}</td></tr>`;
      })
      .join('');

    return res!.type('html').send(
      `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="refresh" content="15"><title>Obiren waitlist: draft preview</title><style>
        body{background:#0E0A16;color:#F5F3FA;font-family:ui-sans-serif,system-ui,-apple-system,sans-serif;margin:0;padding:48px 24px}
        .wrap{max-width:960px;margin:0 auto}
        h1{font-size:22px;margin:0 0 4px}.brand{color:#9B6BFF;font-weight:800}
        p.dim{color:rgba(245,243,250,.5);font-size:13px;margin:0 0 28px}
        .total{display:inline-block;background:rgba(109,74,255,.15);border:1px solid rgba(155,107,255,.3);color:#C9BCFF;border-radius:999px;padding:4px 14px;font-size:13px;font-weight:700;margin-bottom:20px}
        table{width:100%;border-collapse:collapse;font-size:13px;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.1);border-radius:16px;overflow:hidden}
        th{text-align:left;font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:rgba(245,243,250,.45);padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.1)}
        td{padding:12px 16px;border-bottom:1px solid rgba(255,255,255,.06)}
        tr:last-child td{border-bottom:none}
        .email{font-weight:600;color:#fff}.pos{color:#9B6BFF;font-weight:700}.dim{color:rgba(245,243,250,.4)}
        .pill{background:rgba(155,107,255,.12);color:#C9BCFF;border-radius:999px;padding:2px 10px;font-size:11px}
        .status{border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600}.s-pending{background:rgba(255,255,255,.08);color:rgba(245,243,250,.7)}
        .empty{padding:40px;text-align:center;color:rgba(245,243,250,.5)}
        footer{margin-top:24px;font-size:11px;color:rgba(245,243,250,.3)}
      </style></head><body><div class="wrap">
      <h1><span class="brand">Obiren</span> waitlist: draft preview</h1>
      <p class="dim">Dev-only view · auto-refreshes every 15s · production uses the admin-gated /api/v1/waitlist/entries endpoint</p>
      <div class="total">${data.total} ${data.total === 1 ? 'person' : 'people'} on the list</div>
      ${data.total === 0 ? '<table><tr><td class="empty">No signups yet. Be the first.</td></tr></table>' : `<table><thead><tr><th>Position</th><th>Email</th><th>Name</th><th>Source</th><th>Market</th><th>Status</th><th>Joined</th></tr></thead><tbody>${rows}</tbody></table>`}
      <footer>Obiren means “woman” in Itsekiri. · Data: in-memory MongoDB (local preview)</footer>
      </div></body></html>`,
    );
  }
}
