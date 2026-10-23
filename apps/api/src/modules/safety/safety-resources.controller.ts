import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SafetyResourcesService } from './safety-resources.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { EmergencyResourceQuerySchema } from '../../common/validation/api-schemas';

/**
 * Public emergency-directory read. This route is deliberately unauthenticated:
 * someone in crisis must not be blocked by an expired access token, and the
 * payload contains no personal or account data.
 */
@ApiTags('Safety')
@Controller('safety')
export class SafetyResourcesController {
  constructor(private readonly safetyResourcesService: SafetyResourcesService) {}

  @Get('resources')
  @ApiOperation({
    summary: 'List verified emergency and domestic-violence resources',
    description:
      'Returns published emergency, crisis, legal, maternal-health and abuse-support resources for a country, ordered with emergency services first. Each record carries its verification status and recorded freshness: `unreviewed` means no staff check is on record, and `operationallyConfirmed` is true only after a staff review that reached the provider. Obiren does not dispatch emergency services. This route is public and contains no account data.',
  })
  @ApiQuery({ name: 'countryCode', required: false, enum: ['NG', 'GH', 'GB', 'US'], description: 'Country of the resource set (default NG).' })
  @ApiQuery({ name: 'category', required: false, description: 'Case-insensitive category filter.', example: 'Emergency services' })
  @ApiQuery({ name: 'q', required: false, description: 'Case-insensitive text filter over name, summary, city, region and phone.', example: 'lagos' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum records returned, 1–50 (default 50).', example: 25 })
  @ApiResponse({ status: 200, description: 'Country resources with verification and freshness metadata; totals are in meta.' })
  @ApiResponse({ status: 400, description: 'Unsupported country code or invalid query parameters.' })
  async list(@Query(new ZodValidationPipe(EmergencyResourceQuerySchema)) query) {
    return this.safetyResourcesService.list(query);
  }
}
