import { Body, Controller, Get, Param, Patch, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { SupportService } from './support.service';
import { AuthenticatedUser } from '../../common/auth/request-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/auth/roles';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AdminSupportTicketQuerySchema,
  AdminSupportTicketUpdateSchema,
  MongoIdParam,
  SupportFaqQuerySchema,
  SupportTicketCreateSchema,
  SupportTicketListQuerySchema,
  SupportTicketReplySchema,
} from '../../common/validation/api-schemas';

/** FAQ content is public: it contains no account or health data. */
@ApiTags('Support')
@Controller('support')
export class SupportFaqController {
  constructor(private readonly supportService: SupportService) {}

  @Get('faqs')
  @ApiOperation({
    summary: 'List support FAQs',
    description: 'Public, versioned FAQ copy for account, privacy, care, billing and safety questions. Each entry reports its review state; copy is provisional until product and clinical review is recorded.',
  })
  @ApiResponse({ status: 200, description: 'FAQ entries with the content version.' })
  async listFaqs(@Query(new ZodValidationPipe(SupportFaqQuerySchema)) query) {
    return this.supportService.listFaqs(query);
  }
}

@ApiTags('Support')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('support')
export class SupportTicketsController {
  constructor(private readonly supportService: SupportService) {}

  @Post('tickets')
  @ApiOperation({
    summary: 'Raise a support ticket',
    description: 'Creates an owner-scoped support request with a human-readable reference. Tickets are not a clinical channel and no health record is attached automatically.',
  })
  @ApiBody({ schema: { type: 'object', required: ['subject', 'message'], additionalProperties: false, properties: { subject: { type: 'string', maxLength: 160 }, category: { type: 'string', enum: ['account', 'privacy', 'billing', 'technical', 'safety', 'other'], default: 'other' }, message: { type: 'string', maxLength: 4000 } } } })
  @ApiResponse({ status: 201, description: 'Ticket reference and current status.' })
  async createTicket(@Req() req: { user: AuthenticatedUser }, @Body(new ZodValidationPipe(SupportTicketCreateSchema)) body) {
    return this.supportService.createTicket(req.user.sub, body);
  }

  @Get('tickets')
  @ApiOperation({ summary: 'List the caller’s support tickets', description: 'Cursor-paginated tickets owned by the authenticated account, newest first.' })
  @ApiResponse({ status: 200, description: 'Owner tickets and next cursor.' })
  async listTickets(@Req() req: { user: AuthenticatedUser }, @Query(new ZodValidationPipe(SupportTicketListQuerySchema)) query) {
    return this.supportService.listTickets(req.user.sub, query);
  }

  @Get('tickets/:id')
  @ApiParam({ name: 'id', description: '24-character support ticket identifier.' })
  @ApiOperation({ summary: 'Get one support ticket', description: 'Owner-scoped ticket with its reply thread. Other accounts receive 404.' })
  @ApiResponse({ status: 200, description: 'Ticket and replies.' })
  @ApiResponse({ status: 404, description: 'Ticket not found for this account.' })
  async getTicket(@Req() req: { user: AuthenticatedUser }, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.supportService.getTicket(req.user.sub, id);
  }

  @Patch('tickets/:id')
  @ApiParam({ name: 'id', description: '24-character support ticket identifier.' })
  @ApiOperation({ summary: 'Reply to your support ticket', description: 'Appends an owner message. Replying to a resolved or closed ticket reopens it.' })
  @ApiBody({ schema: { type: 'object', required: ['body'], additionalProperties: false, properties: { body: { type: 'string', maxLength: 4000 } } } })
  @ApiResponse({ status: 200, description: 'Updated ticket with the new reply.' })
  @ApiResponse({ status: 404, description: 'Ticket not found for this account.' })
  async reply(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(SupportTicketReplySchema)) body: { body: string },
  ) {
    return this.supportService.replyToTicket(req.user.sub, id, body.body);
  }
}

@ApiTags('Admin')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/support/tickets')
export class SupportAdminController {
  constructor(private readonly supportService: SupportService) {}

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.COMPLIANCE_OFFICER, ROLES.SUPPORT_AGENT)
  @Get()
  @ApiOperation({ summary: 'List support tickets (admin)', description: 'Cross-account ticket queue with status filter. Requires a support, compliance or administrative role.' })
  @ApiResponse({ status: 200, description: 'Tickets and next cursor.' })
  async list(@Req() req: { user: AuthenticatedUser }, @Query(new ZodValidationPipe(AdminSupportTicketQuerySchema)) query) {
    return this.supportService.adminListTickets(req.user, query);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.COMPLIANCE_OFFICER, ROLES.SUPPORT_AGENT)
  @Put(':id')
  @ApiOperation({ summary: 'Update a support ticket (admin)', description: 'Records a support reply and/or changes the ticket status. Resolution timestamps are set server-side and the handling staff member is stored.' })
  @ApiParam({ name: 'id', description: '24-character support ticket identifier.' })
  @ApiResponse({ status: 200, description: 'Updated ticket.' })
  @ApiResponse({ status: 404, description: 'Ticket not found.' })
  async update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(AdminSupportTicketUpdateSchema)) body,
  ) {
    return this.supportService.adminUpdateTicket(req.user, id, body);
  }
}
