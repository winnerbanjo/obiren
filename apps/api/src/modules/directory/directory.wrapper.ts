import { Injectable, Inject, Optional } from '@nestjs/common';
import { DirectoryServiceBackend } from './directory.service';

@Injectable()
export class DirectoryServiceWrapper {
  constructor(private readonly service: DirectoryServiceBackend) {}

  async search(params: any) {
    return this.service.search(params);
  }

  async getServiceById(id: string) {
    return this.service.getServiceById(id);
  }

  async getNearby(lng?: number, lat?: number) {
    return this.service.getNearby(lng, lat);
  }
}
