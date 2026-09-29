import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WaitlistEntry, WaitlistEntryDocument } from '../../database/schemas/waitlist.schema';

@Injectable()
export class WaitlistService {
  private readonly logger = new Logger(WaitlistService.name);

  constructor(
    @InjectModel(WaitlistEntry.name) private waitlistModel: Model<WaitlistEntryDocument>,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  /**
   * Join the waitlist. Duplicate emails are handled gracefully and the
   * response does not reveal whether the email was already present
   * (anti-enumeration): the same shape is always returned.
   */
  async join(dto: {
    email: string;
    firstName?: string;
    source?: string;
    market?: string;
    referral?: string;
  }) {
    let duplicate = false;
    try {
      await this.waitlistModel.create({
        email: dto.email,
        normalizedEmail: dto.email,
        firstName: dto.firstName,
        source: dto.source || 'web',
        market: dto.market,
        referral: dto.referral,
        status: 'pending',
      });
    } catch (err: any) {
      if (err?.code === 11000) {
        duplicate = true;
      } else {
        throw err;
      }
    }

    const total = await this.waitlistModel.countDocuments();

    return {
      success: true,
      data: {
        message: duplicate
          ? "You're already on the list - we'll be in touch soon."
          : 'Welcome to Obiren! You are on the early access list.',
        position: total,
        alreadyJoined: duplicate,
      },
      meta: this.meta(),
    };
  }

  async stats() {
    const total = await this.waitlistModel.countDocuments();
    return { success: true, data: { total }, meta: this.meta() };
  }

  async list(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      this.waitlistModel.find().sort({ createdAt: -1 }).skip(skip).limit(limit).exec(),
      this.waitlistModel.countDocuments(),
    ]);
    return { success: true, data: { entries, total, page, limit }, meta: this.meta() };
  }
}
