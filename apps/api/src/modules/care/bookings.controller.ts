import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiHeader, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/auth/roles';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';
import {
  BookingListQuerySchema,
  CancelBookingSchema,
  ClinicianBookingQuerySchema,
  HoldSlotSchema,
  MongoIdParam,
} from '../../common/validation/api-schemas';

@ApiTags('Bookings')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get()
  @ApiOperation({ summary: 'List the caller’s bookings', description: 'Cursor-paginated bookings owned by the authenticated account, newest first.' })
  @ApiResponse({ status: 200, description: 'Bookings and next cursor.' })
  async list(@Req() req: any, @Query(new ZodValidationPipe(BookingListQuerySchema)) query) {
    return this.bookingsService.listBookings(req.user.sub, query);
  }

  @Post('hold')
  @Idempotent()
  @ApiOperation({
    summary: 'Hold a slot and quote the server-calculated price',
    description: 'Atomically reserves one slot for 10 minutes and records a `held` booking with the server-side price. A hold is not a confirmed appointment; an unpriced session type is refused before inventory is reserved.',
  })
  @ApiBody({ schema: { type: 'object', required: ['slotId'], additionalProperties: false, properties: { slotId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } } } })
  @ApiResponse({ status: 201, description: 'Held booking with amount, currency and hold expiry.' })
  @ApiResponse({ status: 404, description: 'Slot not found.' })
  @ApiResponse({ status: 409, description: 'Slot is already held or booked.' })
  @ApiResponse({ status: 503, description: 'No approved price exists for this session type.' })
  async hold(@Req() req: any, @Body(new ZodValidationPipe(HoldSlotSchema)) body) {
    return this.bookingsService.createHold(req.user.sub, body.slotId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get one booking', description: 'Owner-scoped booking with its latest payment state. Other accounts receive 404.' })
  @ApiParam({ name: 'id', description: '24-character booking identifier.' })
  @ApiResponse({ status: 200, description: 'Booking and payment state.' })
  @ApiResponse({ status: 404, description: 'Booking not found for this account.' })
  async detail(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.bookingsService.getBooking(req.user.sub, id);
  }

  @Post(':id/payment-intent')
  @Idempotent()
  @ApiOperation({
    summary: 'Start a provider checkout for a held booking',
    description: 'Re-reads the approved price server-side, then initializes a Paystack transaction. The booking stays `pending_payment` until a signed, server-verified webhook confirms payment. Checkout is disabled (503) without approved policy and credentials.',
  })
  @ApiParam({ name: 'id', description: '24-character booking identifier.' })
  @ApiResponse({ status: 201, description: 'Payment intent with the provider checkout URL and reference.' })
  @ApiResponse({ status: 409, description: 'Booking is not payable, the hold expired, or the price changed.' })
  @ApiResponse({ status: 503, description: 'Checkout is disabled or the provider is unavailable; no payment was taken.' })
  async paymentIntent(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.bookingsService.createPaymentIntent(req.user.sub, id);
  }

  @Post(':id/cancel')
  @ApiOperation({
    summary: 'Cancel a booking',
    description: 'Owner-scoped cancellation of a held, unpaid or confirmed future booking. No refund is issued automatically: a paid booking is marked `pending_policy` until the approved refund policy exists.',
  })
  @ApiParam({ name: 'id', description: '24-character booking identifier.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, properties: { reason: { type: 'string', maxLength: 300 } } } })
  @ApiResponse({ status: 201, description: 'Booking cancelled with the explicit refund status.' })
  @ApiResponse({ status: 404, description: 'Booking not found for this account.' })
  @ApiResponse({ status: 409, description: 'Booking cannot be cancelled in its current state.' })
  @ApiResponse({ status: 422, description: 'The session has already started or passed.' })
  async cancel(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(CancelBookingSchema)) body,
  ) {
    return this.bookingsService.cancelBooking(req.user.sub, id, body.reason);
  }
}

@ApiTags('Bookings')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller()
export class PaymentsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('payments/:id')
  @ApiOperation({ summary: 'Get one payment', description: 'Owner-scoped payment record, including the provider reference and verification time. No raw card data is ever stored.' })
  @ApiParam({ name: 'id', description: '24-character payment identifier.' })
  @ApiResponse({ status: 200, description: 'Payment record.' })
  @ApiResponse({ status: 404, description: 'Payment not found for this account.' })
  async getPayment(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.bookingsService.getPayment(req.user.sub, id);
  }

  @Get('receipts/:bookingId')
  @ApiOperation({ summary: 'Get a receipt for a paid booking', description: 'Deterministic receipt for a confirmed booking whose payment was verified by the provider. Unpaid bookings return 422.' })
  @ApiParam({ name: 'bookingId', description: '24-character booking identifier.' })
  @ApiResponse({ status: 200, description: 'Receipt.' })
  @ApiResponse({ status: 404, description: 'Booking not found for this account.' })
  @ApiResponse({ status: 422, description: 'The booking is not confirmed or has no verified payment.' })
  async getReceipt(@Req() req: any, @Param('bookingId', new ZodValidationPipe(MongoIdParam)) bookingId: string) {
    return this.bookingsService.getReceipt(req.user.sub, bookingId);
  }
}

/** PRD clinician-side booking read. Scoped to the caller's own clinician profile. */
@ApiTags('Bookings')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.CLINICIAN)
@Controller('clinician')
export class ClinicianBookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Get('bookings')
  @ApiOperation({ summary: 'List bookings for the signed-in clinician', description: 'Returns bookings for the caller’s own clinician profile only. Requires the clinician role and an existing clinician profile.' })
  @ApiResponse({ status: 200, description: 'Clinician bookings and next cursor.' })
  @ApiResponse({ status: 403, description: 'No clinician profile for this account.' })
  async list(@Req() req: any, @Query(new ZodValidationPipe(ClinicianBookingQuerySchema)) query) {
    return this.bookingsService.listClinicianBookings(req.user.sub, query);
  }

  @Post('bookings/:id/complete')
  @ApiParam({ name: 'id', description: '24-character booking identifier.' })
  @ApiOperation({ summary: 'Mark a confirmed session completed', description: 'Scoped to the caller’s own clinician profile. Only a confirmed session that has already started can be completed; payment and refund state are left untouched.' })
  @ApiResponse({ status: 201, description: 'Booking completed.' })
  @ApiResponse({ status: 403, description: 'No clinician profile for this account.' })
  @ApiResponse({ status: 404, description: 'Booking does not belong to this clinician.' })
  @ApiResponse({ status: 409, description: 'Booking is not confirmed.' })
  @ApiResponse({ status: 422, description: 'The session has not started yet.' })
  async complete(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.bookingsService.completeClinicianBooking(req.user.sub, id);
  }
}

@ApiTags('Notifications and webhooks')
@Controller('webhooks/paystack')
export class PaystackWebhookController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({
    summary: 'Paystack payment webhook',
    description: 'Provider-to-server callback. The `x-paystack-signature` HMAC is verified against the raw request body, events are de-duplicated by id, and the transaction is re-verified with Paystack before any booking is confirmed. Amount and currency must match what the API quoted. Not a mobile-client operation.',
  })
  @ApiHeader({ name: 'x-paystack-signature', required: true, description: 'HMAC-SHA512 of the raw body keyed with the Paystack secret key.' })
  @ApiResponse({ status: 200, description: 'Event acknowledged with an explicit processing status.' })
  @ApiResponse({ status: 401, description: 'Missing or invalid signature.' })
  @ApiResponse({ status: 503, description: 'Payments are disabled or the provider is unreachable; the provider should retry.' })
  async handle(@Req() req: RawBodyRequest<Request>, @Headers('x-paystack-signature') signature?: string) {
    return this.bookingsService.handleWebhook(req.rawBody, signature);
  }
}
