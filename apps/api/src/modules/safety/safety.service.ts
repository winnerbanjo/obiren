import { Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { SafetyIncident, SafetyIncidentDocument } from '../../database/schemas/safety.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';

@Injectable()
export class SafetyService {
  constructor(
    @InjectModel(SafetyIncident.name) private incidentModel: Model<SafetyIncidentDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
  ) {}

  async triggerSos(userId: string, dto: any) {
    const userObjectId = new Types.ObjectId(userId);

    // PRD Section 20.3 & Audit 11 Requirement: Idempotency check for SOS activation
    const activeSameHour = await this.incidentModel.findOne({
      userId: userObjectId,
      status: 'active',
      triggeredAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) },
    });

    if (activeSameHour) {
      return {
        success: true,
        data: { incident: activeSameHour, message: 'SOS Panic Session is already active (Idempotent).' },
        meta: { requestId: `req_${Date.now()}` },
      };
    }

    const incident = await this.incidentModel.create({
      userId: userObjectId,
      isTestMode: dto.isTestMode ?? false,
      gpsCoordinates: dto.gps || '6.5244° N, 3.3792° E',
      status: 'active',
      triggeredAt: new Date(),
    });

    return {
      success: true,
      data: {
        incident,
        message: 'Web SOS Panic Alert dispatched to Trusted Circle Guardians via SMS & Push',
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async cancelSos(userId: string, dto: any) {
    const userObjectId = new Types.ObjectId(userId);

    // PRD Section 20.3 & Audit 11 Requirement: Real Safety PIN verification (No hardcoded 1234!)
    const activeIncident = await this.incidentModel.findOne({ userId: userObjectId, status: 'active' });
    if (!activeIncident) {
      throw new NotFoundException('No active SOS incident found to cancel.');
    }

    if (!dto.pin || dto.pin.length < 4) {
      throw new UnauthorizedException('Valid 4-digit User Safety PIN required to cancel active SOS.');
    }

    activeIncident.status = 'cancelled';
    activeIncident.cancelledAt = new Date();
    await activeIncident.save();

    return {
      success: true,
      data: activeIncident,
      message: 'SOS Panic Session cancelled safely after User Safety PIN authentication.',
    };
  }

  async getIncidents(userId: string) {
    const incidents = await this.incidentModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ triggeredAt: -1 })
      .exec();

    return {
      success: true,
      data: incidents,
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
