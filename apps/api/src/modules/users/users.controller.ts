import { Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { UpdateProfileSchema } from '../../common/validation/api-schemas';

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getProfile(@Req() req: any) {
    return this.usersService.getProfile(req.user.sub);
  }

  @Patch('me')
  async updateProfile(@Req() req: any, @Body(new ZodValidationPipe(UpdateProfileSchema)) body) {
    return this.usersService.updateProfile(req.user.sub, body);
  }

  @Get('me/export')
  async exportData(@Req() req: any) {
    return this.usersService.exportUserData(req.user.sub);
  }

  @Post('me/request-deletion')
  async requestDeletion(@Req() req: any) {
    return this.usersService.requestAccountDeletion(req.user.sub);
  }

  @Post('me/cancel-deletion')
  async cancelDeletion(@Req() req: any) {
    return this.usersService.cancelAccountDeletion(req.user.sub);
  }
}
