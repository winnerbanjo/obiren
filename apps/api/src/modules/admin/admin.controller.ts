import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AdminClinicianListQuerySchema, AdminClinicianVerificationSchema, AdminConsultationCreateSchema, DirectoryUpsertSchema, UserStatusSchema, MongoIdParam } from '../../common/validation/api-schemas';

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

  @Roles('super_admin', 'platform_admin')
  @Get('clinicians')
  @ApiOperation({ summary: 'List clinician verification records (admin)', description: 'Returns clinician verification state, evidence references, and review metadata. Requires super_admin or platform_admin.' })
  async listClinicians(@Req() req: any, @Query(new ZodValidationPipe(AdminClinicianListQuerySchema)) query) {
    return this.adminService.listClinicians(req.user, query);
  }

  @Roles('super_admin', 'platform_admin')
  @Put('clinicians/:id/verification')
  @ApiOperation({ summary: 'Review a clinician verification (admin)', description: 'Records an audited verification decision. Verifying requires a stored evidence reference and a linked account holding the clinician role. Only verified, active clinicians appear in the user catalog.' })
  @ApiParam({ name: 'id', description: '24-character clinician profile identifier.' })
  @ApiBody({ schema: { type: 'object', required: ['verificationStatus'], additionalProperties: false, properties: { verificationStatus: { type: 'string', enum: ['pending', 'verified', 'rejected'] }, evidenceRef: { type: 'string', maxLength: 300, description: 'Reference to stored verification evidence; required to verify.' }, note: { type: 'string', maxLength: 500 }, active: { type: 'boolean', description: 'Defaults to true when verified, false otherwise.' } } } })
  @ApiResponse({ status: 200, description: 'Verification decision recorded and audited.' })
  @ApiResponse({ status: 400, description: 'Missing evidence reference.' })
  @ApiResponse({ status: 404, description: 'Clinician profile not found.' })
  @ApiResponse({ status: 422, description: 'Linked account is missing or lacks the clinician role.' })
  async verifyClinician(
    @Req() req: any,
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(AdminClinicianVerificationSchema)) body,
  ) {
    return this.adminService.verifyClinician(req.user, id, body);
  }

  @Roles('super_admin', 'platform_admin')
  @Post('consultations')
  @ApiOperation({ summary: 'Record a patient–clinician consultation (admin)', description: 'Creates a membership-scoped care relationship between an active patient and a verified, active clinician. This is not a booking, payment, or confirmed appointment.' })
  @ApiBody({ schema: { type: 'object', required: ['patientUserId', 'clinicianId'], additionalProperties: false, properties: { patientUserId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }, clinicianId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' } } } })
  @ApiResponse({ status: 201, description: 'Consultation recorded; booking and payment are not confirmed.' })
  @ApiResponse({ status: 404, description: 'Patient account or verified clinician not found.' })
  @ApiResponse({ status: 409, description: 'An open consultation already exists.' })
  async createConsultation(@Req() req: any, @Body(new ZodValidationPipe(AdminConsultationCreateSchema)) body) {
    return this.adminService.createConsultation(req.user, body);
  }

  @Roles('super_admin', 'compliance_officer')
  @Get('audit-logs')
  @ApiOperation({ summary: 'List audit logs (admin)', description: 'Returns the latest audit records. Requires super_admin or compliance_officer role.' })
  async getAuditLogs(@Req() req: any) {
    return this.adminService.getAuditLogs(req.user);
  }
}
