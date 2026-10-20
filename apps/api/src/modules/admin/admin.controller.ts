import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { DirectoryUpsertSchema, UserStatusSchema, MongoIdParam } from '../../common/validation/api-schemas';

@ApiTags('Admin')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles('super_admin', 'platform_admin')
  @Get('metrics')
  @ApiOperation({ summary: 'Get administrative platform metrics', description: 'Returns aggregate user, pregnancy, emergency-resource, and country metrics. Requires a super_admin or platform_admin role.' })
  async getMetrics(@Req() req: any) {
    return this.adminService.getMetrics(req.user);
  }

  @Roles('super_admin', 'platform_admin')
  @Get('users')
  @ApiOperation({ summary: 'List user accounts (admin)', description: 'Returns a paginated account listing. Requires a super_admin or platform_admin role.' })
  async listUsers(@Req() req: any, @Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.listUsers(req.user, Number(page) || 1, Math.min(Number(limit) || 20, 100));
  }

  @Roles('super_admin', 'platform_admin')
  @Put('users/:id/status')
  @ApiOperation({ summary: 'Change an account status (admin)', description: 'Changes a user’s account status. Requires super_admin or platform_admin; only a super_admin may modify another super_admin account.' })
  async setUserStatus(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(UserStatusSchema)) body,
  ) {
    return this.adminService.setUserStatus(req.user, id, body.status);
  }

  @Roles('super_admin', 'platform_admin', 'emergency_manager')
  @Put('directory')
  @ApiOperation({ summary: 'Create or update a directory record (admin)', description: 'Upserts a health-directory record. Requires super_admin, platform_admin, or emergency_manager role.' })
  async upsertDirectory(@Req() req: any, @Body(new ZodValidationPipe(DirectoryUpsertSchema)) body) {
    return this.adminService.upsertDirectoryRecord(req.user, body);
  }

  @Roles('super_admin', 'compliance_officer')
  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs (admin)', description: 'Returns the latest audit records. Requires super_admin or compliance_officer role.' })
  async getAuditLogs(@Req() req: any) {
    return this.adminService.getAuditLogs(req.user);
  }
}
