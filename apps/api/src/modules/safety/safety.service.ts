import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as argon2 from 'argon2';
import { SafetyIncident, SafetyIncidentDocument } from '../../database/schemas/safety.schema';
import { SafetyPin, SafetyPinDocument } from '../../database/schemas/safety-pin.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class SafetyService {
  constructor(
    @InjectModel(SafetyIncident.name) private incidentModel: Model<SafetyIncidentDocument>,
    @InjectModel(SafetyPin.name) private pinModel: Model<SafetyPinDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  // ---------------- Safety PIN management ----------------

  /**
   * Set the Safety PIN. Requires the current PIN when one already exists.
   * The PIN is stored ONLY as an argon2id hash - never in plaintext.
   */
  async setSafetyPin(userId: string, dto: { pin: string; currentPin?: string }) {
    const existing = await this.pinModel.findOne({ userId: new Types.ObjectId(userId) });

    if (existing) {
      if (!dto.currentPin) {
        throw new BadRequestException('Current Safety PIN is required to change it.');
      }
      const valid = await argon2.verify(existing.pinHash, dto.currentPin);
      if (!valid) {
        existing.failedAttempts += 1;
        if (existing.failedAttempts >= MAX_PIN_ATTEMPTS) {
          existing.lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS);
          existing.failedAttempts = 0;
        }
        await existing.save();
        throw new UnauthorizedException('Current Safety PIN is incorrect.');
      }
      existing.pinHash = await argon2.hash(dto.pin, { type: argon2.argon2id });
      existing.failedAttempts = 0;
      existing.lockedUntil = undefined;
      await existing.save();
      return {
        success: true,
        data: { message: 'Safety PIN updated.', hasSafetyPin: true },
        meta: this.meta(),
      };
    }

    await this.pinModel.create({
      userId: new Types.ObjectId(userId),
      pinHash: await argon2.hash(dto.pin, { type: argon2.argon2id }),
    });

    await this.userModel.updateOne({ _id: new Types.ObjectId(userId) }, { $set: { hasSafetyPin: true } });

    return {
      success: true,
      data: { message: 'Safety PIN created.', hasSafetyPin: true },
      meta: this.meta(),
    };
  }

  async hasSafetyPin(userId: string) {
    const existing = await this.pinModel.findOne({ userId: new Types.ObjectId(userId) });
    return {
      success: true,
      data: {
        hasSafetyPin: Boolean(existing),
        locked: Boolean(existing?.lockedUntil && existing.lockedUntil > new Date()),
      },
      meta: this.meta(),
    };
  }

  /** Verify a PIN candidate with attempt throttling. Returns true/false. */
  private async verifyPinWithThrottle(userId: Types.ObjectId, pin: string): Promise<boolean> {
    const record = await this.pinModel.findOne({ userId });
    if (!record) {
      throw new BadRequestException('No Safety PIN configured. Create one before continuing.');
    }

    if (record.lockedUntil && record.lockedUntil > new Date()) {
      throw new HttpException(
        {
          success: false,
          error: {
            code: 'SAFETY_PIN_LOCKED',
            message: 'Safety PIN verification is temporarily locked after repeated failures. Try again later.',
          },
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const valid = await argon2.verify(record.pinHash, pin);
    if (!valid) {
      record.failedAttempts += 1;
      if (record.failedAttempts >= MAX_PIN_ATTEMPTS) {
        record.lockedUntil = new Date(Date.now() + PIN_LOCKOUT_MS);
        record.failedAttempts = 0;
      }
      await record.save();
      return false;
    }

    if (record.failedAttempts > 0 || record.lockedUntil) {
      record.failedAttempts = 0;
      record.lockedUntil = undefined;
      await record.save();
    }
    return true;
  }

  // ---------------- SOS ----------------

  async triggerSos(userId: string, dto: { isTestMode: boolean; gps?: string; notes?: string }) {
    const userObjectId = new Types.ObjectId(userId);

    // Idempotency: reuse an active incident created within the last hour.
    const activeSameHour = await this.incidentModel.findOne({
      userId: userObjectId,
      status: 'active',
      triggeredAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });

    if (activeSameHour) {
      return {
        success: true,
        data: { incident: activeSameHour, message: 'SOS Panic Session is already active.' },
        meta: this.meta(),
      };
    }

    const incident = await this.incidentModel.create({
      userId: userObjectId,
      isTestMode: dto.isTestMode,
      gpsCoordinates: dto.gps,
      notes: dto.notes,
      status: 'active',
      triggeredAt: new Date(),
    });

    return {
      success: true,
      data: {
        incident,
        message: dto.isTestMode
          ? 'SOS test drill started. Guardian alerts are simulated in test mode.'
          : 'SOS Panic Alert dispatched to Trusted Circle Guardians.',
      },
      meta: this.meta(),
    };
  }

  async cancelSos(userId: string, dto: { pin: string }) {
    const userObjectId = new Types.ObjectId(userId);

    const activeIncident = await this.incidentModel.findOne({ userId: userObjectId, status: 'active' });
    if (!activeIncident) {
      throw new NotFoundException('No active SOS incident found to cancel.');
    }

    const pinValid = await this.verifyPinWithThrottle(userObjectId, dto.pin);
    if (!pinValid) {
      throw new UnauthorizedException('Incorrect Safety PIN. The active SOS remains live.');
    }

    activeIncident.status = 'cancelled';
    activeIncident.cancelledAt = new Date();
    await activeIncident.save();

    return {
      success: true,
      data: activeIncident,
      message: 'SOS Panic Session cancelled after Safety PIN verification.',
      meta: this.meta(),
    };
  }

  async getIncidents(userId: string) {
    const incidents = await this.incidentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ triggeredAt: -1 })
      .limit(100)
      .exec();

    return { success: true, data: incidents, meta: this.meta() };
  }
}
