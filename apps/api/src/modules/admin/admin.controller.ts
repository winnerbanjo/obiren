import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Roles('super_admin', 'platform_admin')
  @Get('metrics')
  async getMetrics(@Req() req: any) {
    return this.adminService.getMetrics(req.user);
  }

  @Roles('super_admin', 'compliance_officer')
  @Get('audit-logs')
  async getAuditLogs(@Req() req: any) {
    return this.adminService.getAuditLogs(req.user);
  }
}
