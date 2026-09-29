import { Body, Controller, Get, Post, Query, Req, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
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
}
