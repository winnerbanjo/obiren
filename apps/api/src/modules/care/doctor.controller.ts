import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DoctorService } from './doctor.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/auth/roles';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  ClinicianAppointmentQuerySchema,
  ClinicianCancelAppointmentSchema,
  ClinicianNotificationQuerySchema,
  ClinicianNoteSchema,
  ClinicianProfileUpdateSchema,
  ClinicianRescheduleSchema,
  ClinicianScheduleSchema,
  CreateTimeOffSchema,
  MongoIdParam,
  PreviewScheduleQuerySchema,
} from '../../common/validation/api-schemas';

/**
 * Doctor Portal API.
 *
 * Every route is scoped to the clinician profile linked to the authenticated
 * account; no route accepts a doctor id. Ownership is therefore enforced by
 * construction, and a doctor cannot read or act on another doctor's profile,
 * schedule or appointments by changing an id.
 */
@ApiTags('Doctor Portal')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(ROLES.CLINICIAN)
@Controller('clinician')
export class DoctorController {
  constructor(private readonly doctorService: DoctorService) {}

  @Get('me')
  @ApiOperation({ summary: 'Get the signed-in doctor’s profile', description: 'Returns the caller’s own doctor profile, account and listing status, fees (read-only) and verification state.' })
  @ApiResponse({ status: 200, description: 'Own doctor profile.' })
  @ApiResponse({ status: 403, description: 'No clinician profile is linked to this account.' })
  async me(@Req() req: any) {
    return this.doctorService.getProfile(req.user.sub);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update permitted profile fields',
    description:
      'Doctors can edit public-facing profile fields only. Account status, listing approval, verification and fees stay admin-controlled. Changing a licence number or certification flags the profile for review and hides it from discovery until Obiren re-approves it.',
  })
  @ApiResponse({ status: 200, description: 'Profile updated, with a credential review flag when applicable.' })
  @ApiResponse({ status: 409, description: 'Licence number already registered to another doctor.' })
  async updateMe(@Req() req: any, @Body(new ZodValidationPipe(ClinicianProfileUpdateSchema)) body) {
    return this.doctorService.updateProfile(req.user.sub, body);
  }

  @Get('dashboard')
  @ApiOperation({ summary: 'Get the doctor dashboard', description: 'Real counts and schedule data computed from the same booking records the patient app uses: today, upcoming, pending approval, completed, today’s schedule, pending requests, upcoming appointments, availability snapshot and recent status activity. Dates use the doctor’s own timezone.' })
  @ApiResponse({ status: 200, description: 'Dashboard summary.' })
  async dashboard(@Req() req: any) {
    return this.doctorService.dashboard(req.user.sub);
  }

  @Get('bookings')
  @ApiOperation({ summary: 'List the caller’s appointments', description: 'Doctor-scoped appointment list with filters for status, date range and a search over appointment reference or patient display name. Patient information is limited to display name, optional phone number and the note the patient supplied.' })
  @ApiQuery({ name: 'status', required: false, description: 'Comma-separated appointment statuses.', example: 'pending,confirmed' })
  @ApiQuery({ name: 'from', required: false, description: 'Only appointments starting at or after this ISO instant.' })
  @ApiQuery({ name: 'to', required: false, description: 'Only appointments starting at or before this ISO instant.' })
  @ApiQuery({ name: 'sessionType', required: false, enum: ['clinic', 'audio', 'video', 'text'], description: 'Filter by consultation type.' })
  @ApiQuery({ name: 'q', required: false, description: 'Search appointment reference or patient display name.' })
  @ApiResponse({ status: 200, description: 'Appointments and next cursor.' })
  async listBookings(@Req() req: any, @Query(new ZodValidationPipe(ClinicianAppointmentQuerySchema)) query) {
    return this.doctorService.listAppointments(req.user.sub, query);
  }

  @Get('bookings/:id')
  @ApiOperation({ summary: 'Get one appointment', description: 'Owner-scoped appointment detail: reference, status, patient display name and phone, times with timezone, consultation type, patient note, payment status (never card data) and the full status history. Another doctor’s appointment id is reported as not found.' })
  @ApiParam({ name: 'id', description: '24-character appointment identifier.' })
  @ApiResponse({ status: 200, description: 'Appointment detail with server-computed permitted actions.' })
  @ApiResponse({ status: 404, description: 'No such appointment for this doctor.' })
  async getBooking(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.doctorService.getAppointment(req.user.sub, id);
  }

  @Post('bookings/:id/confirm')
  @ApiOperation({ summary: 'Confirm a pending appointment', description: 'Moves a pending request to confirmed when the doctor’s booking approval mode requires it. Invalid transitions return 409; an appointment that has already started returns 422.' })
  @ApiParam({ name: 'id', description: '24-character appointment identifier.' })
  @ApiResponse({ status: 201, description: 'Appointment confirmed and the patient notified in-app.' })
  @ApiResponse({ status: 409, description: 'Appointment is not awaiting confirmation.' })
  async confirm(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.doctorService.confirmAppointment(req.user.sub, id);
  }

  @Post('bookings/:id/reject')
  @ApiOperation({ summary: 'Reject a pending appointment', description: 'Rejects a pending request with a recorded reason, frees the slot and notifies the patient. A paid booking is marked refund-pending; no refund is issued automatically.' })
  @ApiParam({ name: 'id', description: '24-character appointment identifier.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 3, maxLength: 300 } } } })
  @ApiResponse({ status: 201, description: 'Appointment rejected.' })
  @ApiResponse({ status: 409, description: 'Appointment is not awaiting confirmation.' })
  async reject(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(ClinicianCancelAppointmentSchema)) body) {
    return this.doctorService.rejectAppointment(req.user.sub, id, body.reason);
  }

  @Post('bookings/:id/cancel')
  @ApiOperation({ summary: 'Cancel an appointment', description: 'Cancels a pending or confirmed future appointment with a reason, releases the slot and notifies the patient. Paid bookings become refund-pending under the platform’s approved policy.' })
  @ApiParam({ name: 'id', description: '24-character appointment identifier.' })
  @ApiBody({ schema: { type: 'object', required: ['reason'], additionalProperties: false, properties: { reason: { type: 'string', minLength: 3, maxLength: 300 } } } })
  @ApiResponse({ status: 201, description: 'Appointment cancelled.' })
  @ApiResponse({ status: 422, description: 'The session has already started.' })
  async cancel(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(ClinicianCancelAppointmentSchema)) body) {
    return this.doctorService.cancelAppointment(req.user.sub, id, body.reason);
  }

  @Post('bookings/:id/complete')
  @ApiOperation({ summary: 'Mark a confirmed session completed', description: 'Records that a started, confirmed session took place. Payment and refund state are never modified.' })
  @ApiParam({ name: 'id', description: '24-character appointment identifier.' })
  @ApiResponse({ status: 201, description: 'Appointment completed.' })
  @ApiResponse({ status: 422, description: 'The session has not started yet.' })
  async complete(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.doctorService.completeAppointment(req.user.sub, id);
  }

  @Post('bookings/:id/no-show')
  @ApiOperation({ summary: 'Record a patient no-show', description: 'Available only for a confirmed appointment whose start time has passed. This changes appointment state only; payment and refund state are untouched.' })
  @ApiParam({ name: 'id', description: '24-character appointment identifier.' })
  @ApiBody({ required: false, schema: { type: 'object', additionalProperties: false, properties: { reason: { type: 'string', maxLength: 300 } } } })
  @ApiResponse({ status: 201, description: 'No-show recorded.' })
  @ApiResponse({ status: 422, description: 'The session has not started yet.' })
  async noShow(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(ClinicianNoteSchema)) body) {
    return this.doctorService.markNoShow(req.user.sub, id, body?.reason);
  }

  @Post('bookings/:id/reschedule')
  @ApiOperation({ summary: 'Move an appointment to another slot', description: 'Atomically claims the target open slot before releasing the old one, so concurrent reschedules cannot double-book. The appointment keeps its status, records the previous time, and the patient is notified.' })
  @ApiParam({ name: 'id', description: '24-character appointment identifier.' })
  @ApiBody({ schema: { type: 'object', required: ['slotId'], additionalProperties: false, properties: { slotId: { type: 'string', pattern: '^[0-9a-fA-F]{24}$' }, reason: { type: 'string', maxLength: 300 } } } })
  @ApiResponse({ status: 201, description: 'Appointment rescheduled.' })
  @ApiResponse({ status: 409, description: 'Target slot is unavailable or the appointment is closed.' })
  async reschedule(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string, @Body(new ZodValidationPipe(ClinicianRescheduleSchema)) body) {
    return this.doctorService.rescheduleAppointment(req.user.sub, id, body.slotId, body.reason);
  }

  @Get('schedule')
  @ApiOperation({ summary: 'Get the recurring weekly schedule', description: 'Returns the doctor’s own weekly availability rules in their timezone, consultation duration, buffer, blocked periods and the generated weekly grid.' })
  @ApiResponse({ status: 200, description: 'Schedule and time off.' })
  async getSchedule(@Req() req: any) {
    return this.doctorService.getSchedule(req.user.sub);
  }

  @Patch('schedule')
  @ApiOperation({ summary: 'Save the recurring weekly schedule', description: 'Replaces the weekly rules, rebuilds future unbooked inventory server-side and returns how many slots were generated. Booked and held slots are never removed.' })
  @ApiResponse({ status: 200, description: 'Schedule saved and slots regenerated.' })
  @ApiResponse({ status: 400, description: 'Invalid timezone, duration, buffer or overlapping periods.' })
  async updateSchedule(@Req() req: any, @Body(new ZodValidationPipe(ClinicianScheduleSchema)) body) {
    return this.doctorService.updateSchedule(req.user.sub, body);
  }

  @Get('schedule/preview')
  @ApiOperation({ summary: 'Preview the bookable slots', description: 'Generates and returns the concrete slots the user-facing catalogue will offer, using the same server-side calculation as booking.' })
  @ApiQuery({ name: 'days', required: false, type: Number, description: 'Preview window in days, 1–45 (default 14).', example: 14 })
  @ApiResponse({ status: 200, description: 'Preview slots in UTC.' })
  async preview(@Req() req: any, @Query(new ZodValidationPipe(PreviewScheduleQuerySchema)) query) {
    return this.doctorService.previewSchedule(req.user.sub, query.days);
  }

  @Get('time-off')
  @ApiOperation({ summary: 'List blocked periods', description: 'Returns the doctor’s own leave and blocked time, including recent past entries.' })
  @ApiResponse({ status: 200, description: 'Blocked periods.' })
  async listTimeOff(@Req() req: any) {
    return this.doctorService.listTimeOff(req.user.sub);
  }

  @Post('time-off')
  @ApiOperation({ summary: 'Block a date or time range', description: 'Records time off and returns any existing appointments inside the range so the doctor can resolve them explicitly. Overlapping appointments are never cancelled automatically.' })
  @ApiBody({ schema: { type: 'object', required: ['startsAt', 'endsAt'], additionalProperties: false, properties: { startsAt: { type: 'string', format: 'date-time' }, endsAt: { type: 'string', format: 'date-time' }, reason: { type: 'string', maxLength: 300 } } } })
  @ApiResponse({ status: 201, description: 'Time off recorded, with affected appointments when relevant.' })
  async createTimeOff(@Req() req: any, @Body(new ZodValidationPipe(CreateTimeOffSchema)) body) {
    return this.doctorService.createTimeOff(req.user.sub, body);
  }

  @Delete('time-off/:id')
  @ApiOperation({ summary: 'Remove a blocked period', description: 'Deletes an owned blocked period and regenerates consistent future slots.' })
  @ApiParam({ name: 'id', description: '24-character time-off identifier.' })
  @ApiResponse({ status: 200, description: 'Blocked period removed.' })
  async deleteTimeOff(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.doctorService.deleteTimeOff(req.user.sub, id);
  }

  @Get('notifications')
  @ApiOperation({ summary: 'List in-app notifications', description: 'Doctor-only notification feed for new appointments, confirmations, cancellations, reschedules and reminders. Copy never contains symptoms or diagnoses. External email delivery is best-effort and never blocks the appointment action.' })
  @ApiResponse({ status: 200, description: 'Notifications, unread count and next cursor.' })
  async notifications(@Req() req: any, @Query(new ZodValidationPipe(ClinicianNotificationQuerySchema)) query) {
    return this.doctorService.listNotifications(req.user.sub, query);
  }

  @Post('notifications/:id/read')
  @ApiOperation({ summary: 'Mark a notification read', description: 'Marks one of the caller’s own notifications as read. Another account’s notification id returns 404.' })
  @ApiParam({ name: 'id', description: '24-character notification identifier.' })
  @ApiResponse({ status: 201, description: 'Notification marked read.' })
  async readNotification(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.doctorService.markNotificationRead(req.user.sub, id);
  }
}
