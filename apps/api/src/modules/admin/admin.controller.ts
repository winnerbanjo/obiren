import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DirectoryUpsertSchema, UserStatusSchema, MongoIdParam } from '../../common/validation/api-schemas';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles('super_admin', 'platform_admin')
  @Get('metrics')
  async getMetrics(@Req() req: any) {
    return this.adminService.getMetrics(req.user);
  }

  @Roles('super_admin', 'platform_admin')
  @Get('users')
  async listUsers(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.listUsers(req.user, Number(page) || 1, Math.min(Number(limit) || 20, 100));
  }

  @Roles('super_admin', 'platform_admin')
  @Put('users/:id/status')
  async setUserStatus(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(UserStatusSchema)) body,
  ) {
    return this.adminService.setUserStatus(req.user, id, body.status);
  }

  @Roles('super_admin', 'platform_admin', 'emergency_manager')
  @Put('directory')
  async upsertDirectory(@Req() req: any, @Body(new ZodValidationPipe(DirectoryUpsertSchema)) body) {
    return this.adminService.upsertDirectoryRecord(req.user, body);
  }

  @Roles('super_admin', 'compliance_officer')
  @Get('audit-logs')
  async getAuditLogs(@Req() req: any) {
    return this.adminService.getAuditLogs(req.user);
  }
}
