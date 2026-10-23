import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConsentDocument, ConsentEvent } from '../../database/schemas/consent.schema';

@Injectable()
export class ConsentService {
  constructor(@InjectModel(ConsentEvent.name) private readonly consentModel: Model<ConsentDocument>) {}

  async getHistory(userId: string) {
    const events = await this.consentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ recordedAt: -1, _id: -1 })
      .lean()
      .exec();
    const currentByPurpose = new Map<string, (typeof events)[number]>();
    for (const event of [...events].reverse()) currentByPurpose.set(event.purpose, event);
    const current = [...currentByPurpose.values()].sort((a, b) => a.purpose.localeCompare(b.purpose));
    return {
      success: true,
      data: { current, history: events },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async record(userId: string, input: { purpose: string; policyVersion: string; granted: boolean; source: string }) {
    const event = await this.consentModel.create({ userId: new Types.ObjectId(userId), ...input, recordedAt: new Date() });
    return { success: true, data: event, meta: { requestId: `req_${Date.now()}` } };
  }
}
