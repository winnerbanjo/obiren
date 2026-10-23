import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CareService } from './care.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AvailabilityQuerySchema } from '../../common/validation/api-schemas';

/**
 * Cross-specialist slot listing.
 *
 * The lower-level `/care/holds` surface was removed: it duplicated
 * `POST /bookings/hold` with a second hold resource and was not part of the
 * PRD contract. Clinician-owned availability now lives at `/clinician/slots`.
 */
@ApiTags('Care')
@Controller('care')
export class CareController {
  constructor(private readonly careService: CareService) {}

  @Get('availability')
  @ApiOperation({
    summary: 'List available slots across specialists (deprecated)',
    description:
      'Deprecated: use `GET /specialists/:id/slots` for a specialist-scoped view or `GET /specialists` to discover specialists. Returns open slots for verified clinicians in a country; expired holds count as available.',
    deprecated: true,
  })
  @ApiResponse({ status: 200, description: 'Verified specialist availability.' })
  async listAvailability(@Query(new ZodValidationPipe(AvailabilityQuerySchema)) query): Promise<Record<string, unknown>> {
    return this.careService.listAvailability(query);
  }
}
