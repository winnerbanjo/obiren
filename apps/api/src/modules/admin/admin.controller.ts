import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AdminService } from './admin.service';
import { SafetyResourcesService } from '../safety/safety-resources.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AdminAppointmentQuerySchema,
  AdminClinicianListQuerySchema,
  AdminClinicianVerificationSchema,
  AdminConsultationCreateSchema,
  AdminDoctorCreateSchema,
  AdminDoctorInviteSchema,
  AdminDoctorListQuerySchema,
  AdminDoctorStatusSchema,
  AdminDoctorUpdateSchema,
  AdminPaymentQuerySchema,
  AdminSafetyIncidentQuerySchema,
  DirectoryUpsertSchema,
  UserStatusSchema,
  MongoIdParam,
  EmergencyResourceAdminQuerySchema,
  EmergencyResourceIdParam,
  EmergencyResourceReviewSchema,
} from '../../common/validation/api-schemas';

@ApiTags('Admin')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly safetyResourcesService: SafetyResourcesService,
  ) {}

  @Roles('super_admin', 'platform_admin')
  @Get('metrics')
  @ApiOperation({ summary: 'Get administrative platform metrics', description: 'Returns aggregate user, pregnancy, emergency-resource, and country metrics. Requires a super_admin or platform_admin role.' })
  async getMetrics(@Req() req: any) {
    return this.adminService.getMetrics(req.user);
  }

  @Roles('super_admin', 'platform_admin')
  @Get('appointments')
  @ApiOperation({
    summary: 'List all appointments (admin)',
    description:
      'Cross-platform appointment register with patient identity, doctor, schedule, status and latest payment state. Clinical notes and health records are not joined. Filter by status, date range or search over reference, patient email/name and doctor name.',
  })
  @ApiResponse({ status: 200, description: 'Appointments, total, status counts and pagination.' })
  async listAppointments(@Req() req: any, @Query(new ZodValidationPipe(AdminAppointmentQuerySchema)) query) {
    return this.adminService.listAppointments(req.user, query);
  }

  @Roles('super_admin', 'platform_admin')
  @Get('payments')
  @ApiOperation({
    summary: 'List payment transactions (admin)',
    description:
      'Payment register for operations and finance, with booking, patient, doctor and gateway state. Succeeded totals are grouped by currency. No card data, authorization URL or gateway secret is returned.',
  })
  @ApiResponse({ status: 200, description: 'Payments, totals by currency, status counts and pagination.' })
  async listPayments(@Req() req: any, @Query(new ZodValidationPipe(AdminPaymentQuerySchema)) query) {
    return this.adminService.listPayments(req.user, query);
  }

  @Roles('super_admin', 'platform_admin', 'emergency_manager', 'compliance_officer')
  @Get('safety/incidents')
  @ApiOperation({
    summary: 'List SOS incidents (admin)',
    description:
      'Operational SOS register with incident state and per-delivery counts. Exact GPS coordinates and free-text notes are deliberately omitted from the list view.',
  })
  @ApiResponse({ status: 200, description: 'Incidents and total.' })
  async listSafetyIncidents(@Req() req: any, @Query(new ZodValidationPipe(AdminSafetyIncidentQuerySchema)) query) {
    return this.adminService.listSafetyIncidents(req.user, query);
  }

  @Roles('super_admin', 'platform_admin')
  @Get('platform/status')
  @ApiOperation({
    summary: 'Read runtime platform status (admin)',
    description:
      'Read-only operational readiness: environment, supported country markets and feature availability, payment policy, and whether email, WhatsApp, Google sign-in and Redis are configured. Secrets are never included.',
  })
  @ApiResponse({ status: 200, description: 'Platform readiness without secrets.' })
  async platformStatus(@Req() req: any) {
    return this.adminService.getPlatformStatus(req.user);
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

  @Roles('super_admin', 'platform_admin', 'emergency_manager')
  @Get('safety/resources')
  @ApiOperation({ summary: 'List emergency resources with freshness state (admin)', description: 'Returns every published emergency resource with its recorded verification status, last check, next review due date and freshness. Use the freshness filter to find resources that are due, overdue or never reviewed.' })
  @ApiResponse({ status: 200, description: 'Published resources with recorded review state and freshness counts.' })
  async listEmergencyResources(@Req() req: any, @Query(new ZodValidationPipe(EmergencyResourceAdminQuerySchema)) query) {
    return this.safetyResourcesService.listForAdmin(req.user, query);
  }

  @Roles('super_admin', 'platform_admin', 'emergency_manager')
  @Put('safety/resources/:recordId/review')
  @ApiOperation({ summary: 'Record an emergency-resource review (admin)', description: 'Records who checked a published emergency resource, when, and the resulting verification status. Marking a resource operationally_confirmed requires an evidence reference; the review also sets the next review due date and is audited.' })
  @ApiParam({ name: 'recordId', description: 'Published emergency-resource identifier.', example: 'NG-001' })
  @ApiBody({ schema: { type: 'object', required: ['verificationStatus'], additionalProperties: false, properties: { verificationStatus: { type: 'string', enum: ['source_verified', 'directory_source_verified', 'operationally_confirmed', 'unverified'] }, evidenceRef: { type: 'string', maxLength: 300, description: 'Required to mark a resource operationally confirmed.' }, note: { type: 'string', maxLength: 500 }, nextReviewDueAt: { type: 'string', format: 'date-time', description: 'Defaults to 180 days from now and must be in the future.' } } } })
  @ApiResponse({ status: 200, description: 'Review recorded and audited; freshness recalculated.' })
  @ApiResponse({ status: 400, description: 'Missing evidence reference or a review date in the past.' })
  @ApiResponse({ status: 403, description: 'Caller lacks an administrative role.' })
  @ApiResponse({ status: 404, description: 'No published resource has that identifier.' })
  async reviewEmergencyResource(
    @Req() req: any,
    @Param('recordId', new ZodValidationPipe(EmergencyResourceIdParam)) recordId: string,
    @Body(new ZodValidationPipe(EmergencyResourceReviewSchema)) body,
  ) {
    return this.safetyResourcesService.recordReview(req.user, recordId, body);
  }

  @Roles('super_admin', 'platform_admin')
  @Get('clinicians')
  @ApiOperation({ summary: 'List clinician verification records (admin)', description: 'Returns clinician verification state, evidence references, and review metadata. Requires super_admin or platform_admin.' })
  async listClinicians(@Req() req: any, @Query(new ZodValidationPipe(AdminClinicianListQuerySchema)) query) {
    return this.adminService.listClinicians(req.user, query);
  }

  // ---------------- Doctors section of the existing Admin ----------------

  @Roles('super_admin', 'platform_admin')
  @Get('doctors')
  @ApiOperation({
    summary: 'List doctors (admin)',
    description:
      'Searchable, filterable doctor list for the Admin Doctors section. Each row combines the doctor profile, linked account status, public listing visibility and total booking count. No password, clinical note or patient data is returned.',
  })
  @ApiResponse({ status: 200, description: 'Doctors, total count and per-status counts.' })
  async listDoctors(@Req() req: any, @Query(new ZodValidationPipe(AdminDoctorListQuerySchema)) query) {
    return this.adminService.listDoctors(req.user, query);
  }

  @Roles('super_admin', 'platform_admin')
  @Post('doctors')
  @ApiOperation({
    summary: 'Add a doctor (admin)',
    description:
      'Creates the linked account and doctor profile, then sends a single-use activation invitation. Administrators never set or see a password. Email and licence duplicates are rejected. The doctor only appears in user-facing discovery once verified and listed.',
  })
  @ApiBody({ schema: { type: 'object', required: ['fullName', 'email', 'professionalTitle', 'specialization', 'consultationTypes'], additionalProperties: false, properties: { fullName: { type: 'string', maxLength: 140 }, email: { type: 'string', format: 'email' }, phoneNumber: { type: 'string', maxLength: 20 }, photoUrl: { type: 'string', format: 'uri' }, professionalTitle: { type: 'string', maxLength: 60, example: 'Consultant Obstetrician' }, specialization: { type: 'string', maxLength: 80, example: 'Obstetrics & Gynaecology' }, qualifications: { type: 'array', items: { type: 'string' } }, licenceNumber: { type: 'string', maxLength: 40 }, yearsOfExperience: { type: 'integer', minimum: 0, maximum: 70 }, biography: { type: 'string', maxLength: 2000 }, languages: { type: 'array', items: { type: 'string' } }, clinicName: { type: 'string', maxLength: 160 }, clinicAddress: { type: 'string', maxLength: 300 }, countryCode: { type: 'string', enum: ['NG', 'GH', 'GB', 'US'] }, timeZone: { type: 'string', example: 'Africa/Lagos' }, consultationTypes: { type: 'array', items: { type: 'string', enum: ['clinic', 'audio', 'video', 'text'] } }, consultationDurationMinutes: { type: 'integer', minimum: 10, maximum: 240 }, consultationFeeMinor: { type: 'integer', minimum: 0, description: 'Fee in the country currency minor unit (kobo for NGN). Omit when pricing is not approved.' }, bookingApprovalMode: { type: 'string', enum: ['instant', 'manual'] }, verificationStatus: { type: 'string', enum: ['pending', 'verified'] }, listed: { type: 'boolean' } } } })
  @ApiResponse({ status: 201, description: 'Doctor created; invitation outcome reported honestly.' })
  @ApiResponse({ status: 409, description: 'Duplicate email or licence number.' })
  async createDoctor(@Req() req: any, @Body(new ZodValidationPipe(AdminDoctorCreateSchema)) body) {
    return this.adminService.createDoctor(req.user, body);
  }

  @Roles('super_admin', 'platform_admin')
  @Get('doctors/:id')
  @ApiOperation({ summary: 'Get one doctor (admin)', description: 'Full administrative view of a doctor profile, linked account state, fees, schedule settings and booking count.' })
  @ApiParam({ name: 'id', description: '24-character doctor profile identifier.' })
  @ApiResponse({ status: 200, description: 'Doctor record.' })
  @ApiResponse({ status: 404, description: 'Doctor not found.' })
  async getDoctor(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.adminService.getDoctor(req.user, id);
  }

  @Roles('super_admin', 'platform_admin')
  @Patch('doctors/:id')
  @ApiOperation({ summary: 'Edit a doctor (admin)', description: 'Updates permitted doctor profile fields, fees and public listing. Listing requires a verified profile. Account status is changed through the status action.' })
  @ApiParam({ name: 'id', description: '24-character doctor profile identifier.' })
  @ApiResponse({ status: 200, description: 'Updated doctor record.' })
  @ApiResponse({ status: 422, description: 'Attempt to list an unverified doctor.' })
  async updateDoctor(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(AdminDoctorUpdateSchema)) body) {
    return this.adminService.updateDoctor(req.user, id, body);
  }

  @Roles('super_admin', 'platform_admin')
  @Post('doctors/:id/status')
  @ApiOperation({ summary: 'Activate, deactivate or suspend a doctor (admin)', description: 'Activation restores sign-in; deactivation hides the doctor from discovery; suspension also blocks sign-in, revokes sessions and requires a reason. Recorded and audited.' })
  @ApiParam({ name: 'id', description: '24-character doctor profile identifier.' })
  @ApiBody({ schema: { type: 'object', required: ['status'], additionalProperties: false, properties: { status: { type: 'string', enum: ['active', 'inactive', 'suspended'] }, reason: { type: 'string', maxLength: 300, description: 'Required to suspend.' } } } })
  @ApiResponse({ status: 201, description: 'Doctor status updated.' })
  async setDoctorStatus(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(AdminDoctorStatusSchema)) body) {
    return this.adminService.setDoctorStatus(req.user, id, body.status, body.reason);
  }

  @Roles('super_admin', 'platform_admin')
  @Post('doctors/:id/invite')
  @ApiOperation({ summary: 'Resend a doctor invitation (admin)', description: 'Issues a fresh single-use activation link for a doctor who has not activated yet. Delivery failure is reported, never faked; in non-production without email the one-time token is returned once.' })
  @ApiParam({ name: 'id', description: '24-character doctor profile identifier.' })
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false } })
  @ApiResponse({ status: 201, description: 'Invitation reissued, with honest delivery state.' })
  @ApiResponse({ status: 409, description: 'The doctor has already activated their account.' })
  async inviteDoctor(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(AdminDoctorInviteSchema)) _body) {
    return this.adminService.inviteDoctor(req.user, id);
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
