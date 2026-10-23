import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { env } from '../../config/env.validation';
import { IdempotencyRecord, IdempotencyRecordDocument } from '../../database/schemas/idempotency.schema';

export type IdempotencyBeginResult =
  | { state: 'new'; recordId: string }
  | { state: 'replay'; statusCode: number; body: Record<string, unknown> };

/** Shape read back from Mongo; avoids leaking Mongoose generics into casts. */
interface StoredIdempotencyRecord {
  status: string;
  responseStatus?: number;
  response?: Record<string, unknown>;
  requestHash: string;
}

@Injectable()
export class IdempotencyService {
  constructor(
    @InjectModel(IdempotencyRecord.name)
    private readonly idempotencyModel: Model<IdempotencyRecordDocument>,
  ) {}

  private expiry(): Date {
    return new Date(Date.now() + env().idempotencyTtlSeconds * 1000);
  }

  private replay(record: StoredIdempotencyRecord): IdempotencyBeginResult {
    if (record.status === 'completed') {
      return {
        state: 'replay',
        statusCode: record.responseStatus || 200,
        body: (record.response || {}) as Record<string, unknown>,
      };
    }
    throw new ConflictException({
      success: false,
      error: {
        code: 'IDEMPOTENCY_IN_PROGRESS',
        message: 'An identical request is still being processed. Retry shortly.',
      },
    });
  }

  async begin(userId: string, key: string, route: string, requestHash: string): Promise<IdempotencyBeginResult> {
    const owner = new Types.ObjectId(userId);
    const existing = await this.idempotencyModel.findOne({ userId: owner, route, key }).lean().exec();
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw new ConflictException({
          success: false,
          error: {
            code: 'IDEMPOTENCY_KEY_REUSED',
            message: 'This Idempotency-Key was already used with a different request payload.',
          },
        });
      }
      return this.replay(existing as unknown as StoredIdempotencyRecord);
    }

    try {
      const created = await this.idempotencyModel.create({
        userId: owner,
        key,
        route,
        requestHash,
        status: 'processing',
        expiresAt: this.expiry(),
      });
      return { state: 'new', recordId: created._id.toString() };
    } catch (error: unknown) {
      if ((error as { code?: unknown } | null)?.code === 11000) {
        const raced = await this.idempotencyModel.findOne({ userId: owner, route, key }).lean().exec();
        if (!raced) throw error;
        if (raced.requestHash !== requestHash) {
          throw new ConflictException({
            success: false,
            error: {
              code: 'IDEMPOTENCY_KEY_REUSED',
              message: 'This Idempotency-Key was already used with a different request payload.',
            },
          });
        }
        return this.replay(raced as unknown as StoredIdempotencyRecord);
      }
      throw error;
    }
  }

  async complete(recordId: string, statusCode: number, body: Record<string, unknown>): Promise<void> {
    await this.idempotencyModel.updateOne(
      { _id: new Types.ObjectId(recordId), status: 'processing' },
      { $set: { status: 'completed', responseStatus: statusCode, response: body, expiresAt: this.expiry() } },
    );
  }

  /** Releases a reservation whose handler failed, so clients can retry. */
  async release(recordId: string): Promise<void> {
    await this.idempotencyModel.deleteOne({ _id: new Types.ObjectId(recordId), status: 'processing' });
  }
}
