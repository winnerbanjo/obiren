import { Body, Controller, Get, Post, Query, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { WaitlistService } from './waitlist.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { WaitlistSignupSchema } from '../../common/validation/api-schemas';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@Controller('waitlist')
export class WaitlistController {
  constructor(private readonly waitlistService: WaitlistService) {}

  /** Public signup - stricter rate limit (10 per minute per IP) and validated. */
  @Post()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async join(@Body(new ZodValidationPipe(WaitlistSignupSchema)) body) {
    return this.waitlistService.join(body);
  }

  @Get()
  async stats() {
    return this.waitlistService.stats();
  }

  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('super_admin', 'platform_admin')
  @Get('entries')
  async list(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.waitlistService.list(Number(page) || 1, Math.min(Number(limit) || 50, 200));
  }

  /**
   * DEV-ONLY draft view of captured waitlist emails (HTML or ?format=json).
   * Hard-disabled in production. The JWT-guarded /entries endpoint is the
   * real audit surface there.
   */
  @Get('preview')
  async preview(@Query('format') format?: string, @Res() res?: Response) {
    if (process.env.NODE_ENV === 'production') {
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
