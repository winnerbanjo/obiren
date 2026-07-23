import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DirectoryController } from './directory.controller';
import { DirectoryServiceBackend } from './directory.service';
import { DirectoryService, DirectoryServiceSchema } from '../../database/schemas/directory.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: DirectoryService.name, schema: DirectoryServiceSchema }]),
  ],
  controllers: [DirectoryController],
  providers: [DirectoryServiceBackend],
  exports: [DirectoryServiceBackend],
})
export class DirectoryModule {}
