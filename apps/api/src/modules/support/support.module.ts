import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { SupportAdminController, SupportFaqController, SupportTicketsController } from './support.controller';
import { SupportService } from './support.service';
import { SupportTicket, SupportTicketSchema } from '../../database/schemas/support.schema';
import { User, UserProfile, UserProfileSchema, UserSchema } from '../../database/schemas/user.schema';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: SupportTicket.name, schema: SupportTicketSchema },
      { name: User.name, schema: UserSchema },
      { name: UserProfile.name, schema: UserProfileSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [SupportFaqController, SupportTicketsController, SupportAdminController],
  providers: [SupportService],
  exports: [SupportService],
})
export class SupportModule {}
