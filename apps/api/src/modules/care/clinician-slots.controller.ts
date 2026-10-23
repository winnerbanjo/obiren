import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CareService } from './care.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/auth/roles';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ClinicianSlotListQuerySchema,
  CreateAvailabilitySchema,
  MongoIdParam,
  UpdateClinicianSlotSchema,
} from '../../common/validation/api-schemas';

/**
 * PRD `CLINICIAN /clinician/slots` — maintain availability.
 *
 * Every route is scoped to the caller's own active, verified clinician profile:
 * a clinician can never read or change another clinician's inventory. Slots that
 * are actively held or booked cannot be edited or deleted (409), and a delete is
 * a hard delete so the uniquely indexed start time can be republished.
 */
@ApiTags('Bookings')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.CLINICIAN)
@Controller('clinician')
export class ClinicianSlotsController {
  constructor(private readonly careService: CareService) {}

  @Get('slots')
  @ApiOperation({
    summary: 'List the caller’s availability slots',
    description:
      'Returns future slots for the signed-in clinician only, ordered by start time. Requires the clinician role and an active, verified clinician profile.',
  })
  @ApiResponse({ status: 200, description: 'Own availability slots.' })
  @ApiResponse({ status: 403, description: 'No active, verified clinician profile for this account.' })
  async list(@Req() req: any, @Query(new ZodValidationPipe(ClinicianSlotListQuerySchema)) query) {
    return this.careService.listClinicianSlots(req.user.sub, query);
  }

  @Post('slots')
  @ApiOperation({
    summary: 'Publish an availability slot',
    description:
      'Publishes one future slot for the signed-in clinician. No price or booking entitlement is created: an unpriced session type still fails closed at checkout.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['startsAt', 'endsAt', 'sessionType'],
      additionalProperties: false,
      properties: {
        startsAt: { type: 'string', format: 'date-time' },
        endsAt: { type: 'string', format: 'date-time' },
        sessionType: { type: 'string', enum: ['clinic', 'audio', 'video', 'text'] },
      },
    },
  })
  @ApiResponse({ status: 201, description: 'Availability slot published.' })
  @ApiResponse({ status: 403, description: 'Active verified clinician profile required.' })
  @ApiResponse({ status: 409, description: 'A slot already exists at that start time.' })
  async create(@Req() req: any, @Body(new ZodValidationPipe(CreateAvailabilitySchema)) body) {
    return this.careService.createClinicianSlot(req.user.sub, body);
  }

  @Patch('slots/:id')
  @ApiParam({ name: 'id', description: '24-character availability slot identifier.' })
  @ApiOperation({
    summary: 'Update an availability slot',
    description:
      'Owner-scoped partial update of start, end or session type. Only open (or expired-hold) slots can be changed; a held or booked slot returns 409.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        startsAt: { type: 'string', format: 'date-time' },
        endsAt: { type: 'string', format: 'date-time' },
        sessionType: { type: 'string', enum: ['clinic', 'audio', 'video', 'text'] },
      },
    },
  })
  @ApiResponse({ status: 200, description: 'Slot updated.' })
  @ApiResponse({ status: 404, description: 'No such slot for this clinician.' })
  @ApiResponse({ status: 409, description: 'Slot is held or booked.' })
  async update(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(UpdateClinicianSlotSchema)) body) {
    return this.careService.updateClinicianSlot(req.user.sub, id, body);
  }

  @Delete('slots/:id')
  @ApiParam({ name: 'id', description: '24-character availability slot identifier.' })
  @ApiOperation({
    summary: 'Delete an availability slot',
    description:
      'Owner-scoped removal of an open slot. A held or booked slot cannot be deleted (409); cancel the booking instead. Nothing that has been paid for is removed.',
  })
  @ApiResponse({ status: 200, description: 'Slot deleted.' })
  @ApiResponse({ status: 404, description: 'No such slot for this clinician.' })
  @ApiResponse({ status: 409, description: 'Slot is held or booked.' })
  async remove(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.careService.deleteClinicianSlot(req.user.sub, id);
  }
}
