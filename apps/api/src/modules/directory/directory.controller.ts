import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DirectoryServiceBackend } from './directory.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DirectorySearchSchema, DirectoryNearbySchema } from '../../common/validation/api-schemas';

@ApiTags('Directory')
@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryServiceBackend) {}

  @Get('search')
  @ApiOperation({ summary: 'Search the health and emergency directory', description: 'Searches verified directory resources by text, category, and country. Results are paginated; use countryCode=ALL to search across countries.' })
  @ApiQuery({ name: 'q', required: false, description: 'Search text matched against organization name, category, and service summary.', example: 'maternity hospital' })
  @ApiQuery({ name: 'countryCode', required: false, enum: ['NG', 'GH', 'GB', 'US', 'ALL'], example: 'NG' })
  @ApiQuery({ name: 'category', required: false, description: 'Category filter.', example: 'Emergency' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '1-based page number (default 1; maximum 1000).', example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Results per page (default 20; maximum 50).', example: 20 })
  @ApiResponse({ status: 200, description: 'Matching directory records; pagination totals are in meta.' })
  async search(@Query(new ZodValidationPipe(DirectorySearchSchema)) query) {
    return this.directoryService.search(query);
  }

  @Get('nearby')
  @ApiOperation({ summary: 'Find nearby health and emergency services', description: 'Returns resources near WGS84 coordinates. Longitude is -180..180, latitude is -90..90, and distance is in meters.' })
  @ApiQuery({ name: 'lng', required: true, type: Number, description: 'Longitude in decimal degrees (WGS84).', example: 3.3792 })
  @ApiQuery({ name: 'lat', required: true, type: Number, description: 'Latitude in decimal degrees (WGS84).', example: 6.5244 })
  @ApiQuery({ name: 'maxDistanceMeters', required: false, type: Number, description: 'Search radius, 100–200000 meters (default 50000).', example: 25000 })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: 'Maximum results, 1–50 (default 20).', example: 20 })
  @ApiResponse({ status: 200, description: 'Nearby directory records ordered by proximity.', content: { 'application/json': { example: { success: true, data: [{ record_id: 'NG-LAG-001', organisation_name: 'Example Maternity Centre', top_category: 'Maternity care', countryCode: 'NG', city: 'Lagos', phone: '+234 800 000 0000', service_summary: 'Maternity and emergency obstetric care', verification_status: 'Source verified' }], meta: { total: 1, requestId: 'req_1729339200000' } } } } })
  async getNearby(@Query(new ZodValidationPipe(DirectoryNearbySchema)) query) {
    return this.directoryService.getNearby(query.lng, query.lat, query.maxDistanceMeters, query.limit);
  }

  @Get('services/:serviceId')
  @ApiOperation({ summary: 'Get a directory resource', description: 'Looks up a resource by its public directory record_id. A missing record is returned as data: null.' })
  @ApiParam({ name: 'serviceId', description: 'Directory record identifier.', example: 'NG-LAG-001' })
  @ApiResponse({ status: 200, description: 'Directory record or null when it does not exist.' })
  async getServiceById(@Param('serviceId') serviceId: string) {
    return this.directoryService.getServiceById(serviceId);
  }
}
