import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WaitlistController } from './waitlist.controller';
import { WaitlistService } from './waitlist.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { WaitlistEntry, WaitlistEntrySchema } from '../../database/schemas/waitlist.schema';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: WaitlistEntry.name, schema: WaitlistEntrySchema }]),
    JwtAuthModule,
  ],
  controllers: [WaitlistController],
  providers: [WaitlistService],
})
export class WaitlistModule {}
