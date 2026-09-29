import { Controller, Get, Param, Query } from '@nestjs/common';
import { DirectoryServiceBackend } from './directory.service';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DirectorySearchSchema, DirectoryNearbySchema } from '../../common/validation/api-schemas';

@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryServiceBackend) {}

  @Get('search')
  async search(@Query(new ZodValidationPipe(DirectorySearchSchema)) query) {
    return this.directoryService.search(query);
  }

  @Get('nearby')
  async getNearby(@Query(new ZodValidationPipe(DirectoryNearbySchema)) query) {
    return this.directoryService.getNearby(query.lng, query.lat, query.maxDistanceMeters, query.limit);
  }

  @Get('services/:serviceId')
  async getServiceById(@Param('serviceId') serviceId: string) {
    return this.directoryService.getServiceById(serviceId);
  }
}
