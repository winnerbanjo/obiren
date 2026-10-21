import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { PromotionsService } from './promotions.service';
import { AuthenticatedUser } from '../../common/auth/request-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/auth/roles';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminPromoCodeCreateSchema, PromoCodeValidateSchema } from '../../common/validation/api-schemas';

@ApiTags('Bookings')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Post('validate')
  @ApiOperation({
    summary: 'Validate a promo code against the server price',
    description: 'Quotes the discount from the stored promotion and the server-side session price. Nothing is charged, reserved or redeemed: `applied` stays false while the payment and promotion policy is unapproved.',
  })
  @ApiBody({ schema: { type: 'object', required: ['code', 'clinicianId', 'sessionType'], additionalProperties: false, properties: { code: { type: 'string', maxLength: 40 }, clinicianId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }, sessionType: { type: 'string', enum: ['clinic', 'audio', 'video', 'text'] } } } })
  @ApiResponse({ status: 201, description: 'Quoted discount and payable amount; not applied.' })
  @ApiResponse({ status: 404, description: 'Unknown or expired promo code.' })
  @ApiResponse({ status: 409, description: 'No redemptions remain.' })
  @ApiResponse({ status: 503, description: 'No approved price exists for this clinician and session type.' })
  async validate(@Body(new ZodValidationPipe(PromoCodeValidateSchema)) body) {
    return this.promotionsService.validate(body.code, body.clinicianId, body.sessionType);
  }
}

@ApiTags('Admin')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/promo-codes')
export class AdminPromoCodesController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN)
  @Post()
  @ApiOperation({ summary: 'Create a promo code (admin)', description: 'Stores a promotion with its policy version. Creating a code does not enable discounted checkout; that stays behind the approved payment policy.' })
  @ApiResponse({ status: 201, description: 'Promo code created.' })
  @ApiResponse({ status: 409, description: 'Code already exists.' })
  async create(@Req() req: { user: AuthenticatedUser }, @Body(new ZodValidationPipe(AdminPromoCodeCreateSchema)) body) {
    return this.promotionsService.create(req.user, body);
  }
}

@ApiTags('Subscriptions')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get('me')
  @ApiOperation({
    summary: 'Read the caller’s entitlements',
    description: 'Derives entitlements from persisted, provider-verified bookings. No subscription plans are published yet, so `plan` is null and `policyPending` is true rather than inventing a catalogue.',
  })
  @ApiResponse({ status: 200, description: 'Entitlements, usage counts and the explicit policy-pending state.' })
  async me(@Req() req: { user: AuthenticatedUser }) {
    return this.promotionsService.subscriptionsFor(req.user.sub);
  }
}
