import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { SupportTicket, SupportTicketDocument } from '../../database/schemas/support.schema';
import { SUPPORT_FAQS, SUPPORT_FAQ_VERSION, SupportFaq } from './support-faqs';
import { requireAdminRole } from '../admin/admin.service';
import { AuthenticatedUser } from '../../common/auth/request-user';

interface SupportTicketView {
  _id: Types.ObjectId;
  userId?: Types.ObjectId;
  reference: string;
  subject: string;
  category: string;
  message: string;
  status: string;
  replies?: Array<{ authorRole: string; body: string; createdAt?: Date }>;
  createdAt?: Date;
  updatedAt?: Date;
  resolvedAt?: Date;
}

const SUPPORT_ROLES = ['super_admin', 'platform_admin', 'compliance_officer', 'support_agent'];

@Injectable()
export class SupportService {
  constructor(
    @InjectModel(SupportTicket.name) private readonly ticketModel: Model<SupportTicketDocument>,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  private presentTicket(ticket: SupportTicketView) {
    return {
      id: ticket._id.toString(),
      reference: ticket.reference,
      subject: ticket.subject,
      category: ticket.category,
      message: ticket.message,
      status: ticket.status,
      replies: (ticket.replies || []).map((reply) => ({
        authorRole: reply.authorRole,
        body: reply.body,
        createdAt: reply.createdAt,
      })),
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt ?? null,
    };
  }

  /**
   * FAQ content is static, versioned copy. Every entry reports its own review
   * state so unapproved wording is never presented as reviewed policy.
   */
  listFaqs(params: { category?: SupportFaq['category'] }) {
    const faqs = params.category ? SUPPORT_FAQS.filter((faq) => faq.category === params.category) : SUPPORT_FAQS;
    return {
      success: true,
      data: {
        version: SUPPORT_FAQ_VERSION,
        reviewStatus: 'provisional_pending_product_review',
        faqs: faqs.map((faq) => ({ ...faq })),
        note: 'FAQ copy is provisional until product and clinical review is recorded.',
      },
      meta: { ...this.meta(), total: faqs.length },
    };
  }

  private newReference(): string {
    return `SUP-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  async createTicket(
    userId: string,
    input: { subject: string; category: string; message: string },
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        const ticket = await this.ticketModel.create({
          userId: new Types.ObjectId(userId),
          reference: this.newReference(),
          subject: input.subject,
          category: input.category,
          message: input.message,
          status: 'open',
          replies: [],
        });
        return {
          success: true,
          data: {
            ...this.presentTicket(ticket.toObject() as unknown as SupportTicketView),
            responseExpectation: 'Support is handled by the operations team during published support hours.',
          },
          meta: this.meta(),
        };
      } catch (error) {
        // Reference collision is the only retryable failure; anything else is real.
        if ((error as { code?: unknown })?.code !== 11000) throw error;
      }
    }
    throw new Error('Could not allocate a support ticket reference');
  }

  async listTickets(userId: string, query: { cursor?: string; limit: number }) {
    const filter: Record<string, unknown> = { userId: new Types.ObjectId(userId) };
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.ticketModel.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean().exec();
    const hasNext = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    return {
      success: true,
      data: {
        tickets: selected.map((ticket) => this.presentTicket(ticket as unknown as SupportTicketView)),
        nextCursor: hasNext ? selected[selected.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  async getTicket(userId: string, ticketId: string) {
    const ticket = await this.ticketModel
      .findOne({ _id: new Types.ObjectId(ticketId), userId: new Types.ObjectId(userId) })
      .lean()
      .exec();
    if (!ticket) throw new NotFoundException('Support ticket not found for this account');
    return { success: true, data: this.presentTicket(ticket as unknown as SupportTicketView), meta: this.meta() };
  }

  /** Owner follow-up. Closed/resolved tickets accept no new messages. */
  async replyToTicket(userId: string, ticketId: string, body: string) {
    const ticket = await this.ticketModel.findOne({
      _id: new Types.ObjectId(ticketId),
      userId: new Types.ObjectId(userId),
    });
    if (!ticket) throw new NotFoundException('Support ticket not found for this account');
    ticket.replies.push({ authorRole: 'user', body, createdAt: new Date() });
    if (ticket.status === 'resolved' || ticket.status === 'closed') ticket.status = 'open';
    await ticket.save();
    return { success: true, data: this.presentTicket(ticket.toObject() as unknown as SupportTicketView), meta: this.meta() };
  }

  async adminListTickets(adminUser: AuthenticatedUser, query: { status?: string; cursor?: string; limit: number }) {
    requireAdminRole(adminUser, SUPPORT_ROLES);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.ticketModel.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean().exec();
    const hasNext = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    return {
      success: true,
      data: {
        tickets: selected.map((ticket) => ({
          ...this.presentTicket(ticket as unknown as SupportTicketView),
          userId: ticket.userId!.toString(),
        })),
        nextCursor: hasNext ? selected[selected.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  async adminUpdateTicket(
    adminUser: AuthenticatedUser,
    ticketId: string,
    input: { status?: string; reply?: string },
  ) {
    requireAdminRole(adminUser, SUPPORT_ROLES);
    const ticket = await this.ticketModel.findById(ticketId);
    if (!ticket) throw new NotFoundException('Support ticket not found');
    if (input.reply) ticket.replies.push({ authorRole: 'support', body: input.reply, createdAt: new Date() });
    if (input.status) {
      ticket.status = input.status;
      ticket.resolvedAt = ['resolved', 'closed'].includes(input.status) ? new Date() : undefined;
    }
    ticket.handledByUserId = new Types.ObjectId(adminUser.sub);
    await ticket.save();
    return { success: true, data: this.presentTicket(ticket.toObject() as unknown as SupportTicketView), meta: this.meta() };
  }
}
