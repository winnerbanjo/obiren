import { Controller, Get, Query, Param } from '@nestjs/common';
import { DirectoryServiceBackend } from './directory.service';

@Controller('directory')
export class DirectoryController {
  constructor(private readonly directoryService: DirectoryServiceBackend) {}

  @Get('search')
  async search(@Query() query: any) {
    return this.directoryService.search(query);
  }

  @Get('services/:serviceId')
  async getServiceById(@Param('serviceId') serviceId: string) {
    return this.directoryService.getServiceById(serviceId);
  }

  @Get('nearby')
  async getNearby(@Query('lng') lng: number, @Query('lat') lat: number) {
    return this.directoryService.getNearby(lng, lat);
  }
}
