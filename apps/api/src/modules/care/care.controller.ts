import { Body, Controller, Delete, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CareService } from './care.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/auth/roles';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AvailabilityQuerySchema, CareCatalogQuerySchema, CreateAvailabilitySchema, HoldSlotSchema, MongoIdParam } from '../../common/validation/api-schemas';
import { Idempotent } from '../../common/idempotency/idempotent.decorator';

@ApiTags('Care')
@Controller('care')
export class CareController {
  constructor(private readonly careService: CareService) {}

  @Get('clinicians')
  @ApiOperation({ summary: 'List active verified specialists', description: 'Unverified or inactive clinicians are never exposed in the user catalog.' })
  @ApiResponse({ status: 200, description: 'Verified clinician catalog.' })
  async listClinicians(@Query(new ZodValidationPipe(CareCatalogQuerySchema)) query): Promise<Record<string, unknown>> { return this.careService.listClinicians(query); }

  @Get('availability')
  @ApiOperation({ summary: 'List available specialist slots', description: 'Only slots owned by active verified clinicians are returned. Expired holds are treated as open.' })
  @ApiResponse({ status: 200, description: 'Verified specialist availability.' })
  async listAvailability(@Query(new ZodValidationPipe(AvailabilityQuerySchema)) query): Promise<Record<string, unknown>> { return this.careService.listAvailability(query); }

  @Post('availability')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(ROLES.CLINICIAN)
  @ApiOperation({ summary: 'Publish a clinician availability slot', description: 'Only a verified clinician may publish future availability. No price or booking entitlement is created.' })
  @ApiBody({ schema: { type: 'object', required: ['startsAt', 'endsAt', 'sessionType'], additionalProperties: false, properties: { startsAt: { type: 'string', format: 'date-time' }, endsAt: { type: 'string', format: 'date-time' }, sessionType: { type: 'string', enum: ['clinic', 'audio', 'video', 'text'] } } } })
  @ApiResponse({ status: 201, description: 'Availability slot published.' })
  @ApiResponse({ status: 403, description: 'Active verified clinician profile required.' })
  async createAvailability(@Req() req: any, @Body(new ZodValidationPipe(CreateAvailabilitySchema)) body) { return this.careService.createAvailability(req.user.sub, body); }

  @Get('holds')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'List the caller’s active temporary holds', description: 'Returns only non-expired holds owned by the authenticated user. Holds do not confirm appointments or payments.' })
  @ApiResponse({ status: 200, description: 'Active temporary holds.' })
  async listMyHolds(@Req() req: any) { return this.careService.listMyHolds(req.user.sub); }

  @Post('holds')
  @Idempotent()
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Create a temporary slot hold', description: 'Atomically holds one slot for 10 minutes. This is not a booking, payment, or confirmed appointment.' })
  @ApiBody({ schema: { type: 'object', required: ['slotId'], additionalProperties: false, properties: { slotId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } } } })
  @ApiResponse({ status: 201, description: 'Temporary hold created; no booking or payment confirmed.' })
  @ApiResponse({ status: 409, description: 'Slot has already been held or booked.' })
  async holdSlot(@Req() req: any, @Body(new ZodValidationPipe(HoldSlotSchema)) body) { return this.careService.holdSlot(req.user.sub, body.slotId); }

  @Delete('holds/:id')
  @ApiBearerAuth('accessToken')
  @UseGuards(JwtAuthGuard)
  @ApiParam({ name: 'id', description: '24-character booking hold identifier.' })
  @ApiOperation({ summary: 'Cancel a temporary hold', description: 'Only the hold owner can release it. Confirmed booking cancellation is not implemented.' })
  @ApiResponse({ status: 200, description: 'Temporary hold cancelled.' })
  @ApiResponse({ status: 404, description: 'Active hold not found for this account.' })
  async cancelHold(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) { return this.careService.cancelHold(req.user.sub, id); }
}
