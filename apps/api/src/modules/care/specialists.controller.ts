import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CareService } from './care.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { MongoIdParam, SpecialistQuerySchema, SpecialistSlotsQuerySchema } from '../../common/validation/api-schemas';

/**
 * PRD `/specialists` catalog. Public, read-only and restricted to active,
 * verified clinicians; unverified or inactive practitioners never appear.
 */
@ApiTags('Specialists')
@Controller('specialists')
export class SpecialistsController {
  constructor(private readonly careService: CareService) {}

  @Get()
  @ApiOperation({ summary: 'List verified specialists', description: 'Cursor-paginated catalog of active, verified specialists with their priced session types. Unverified or inactive practitioners are never returned.' })
  @ApiResponse({ status: 200, description: 'Verified specialist catalog and next cursor.' })
  async list(@Query(new ZodValidationPipe(SpecialistQuerySchema)) query) {
    return this.careService.listSpecialists(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specialist profile', description: 'Returns one active, verified specialist. Unverified or inactive profiles are reported as not found.' })
  @ApiParam({ name: 'id', description: '24-character specialist identifier.' })
  @ApiResponse({ status: 200, description: 'Specialist profile.' })
  @ApiResponse({ status: 404, description: 'No verified specialist with that identifier.' })
  async detail(@Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.careService.getSpecialist(id);
  }

  @Get(':id/slots')
  @ApiOperation({ summary: 'List a specialist’s available slots', description: 'Returns bookable future slots for one verified specialist, optionally filtered by session type. Expired holds count as available.' })
  @ApiParam({ name: 'id', description: '24-character specialist identifier.' })
  @ApiResponse({ status: 200, description: 'Specialist and their available slots.' })
  @ApiResponse({ status: 404, description: 'No verified specialist with that identifier.' })
  async slots(@Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Query(new ZodValidationPipe(SpecialistSlotsQuerySchema)) query) {
    return this.careService.listSpecialistSlots(id, query);
  }
}
