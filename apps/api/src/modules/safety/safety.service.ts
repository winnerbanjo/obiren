import { BadRequestException, HttpException, HttpStatus, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as argon2 from 'argon2';
import * as crypto from 'crypto';
import { GuardianContact, GuardianContactDocument, GuardianInvite, GuardianInviteDocument, LocationSession, LocationSessionDocument, SafetyDeliveryAttempt, SafetyDeliveryAttemptDocument } from '../../database/schemas/safety.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { SafetyIncident, SafetyIncidentDocument } from '../../database/schemas/safety.schema';
import { SafetyPin, SafetyPinDocument } from '../../database/schemas/safety-pin.schema';
import { User, UserDocument } from '../../database/schemas/user.schema';
import { AuditLog, AuditLogDocument } from '../../database/schemas/audit-log.schema';
import { UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';

const MAX_PIN_ATTEMPTS = 5;
const PIN_LOCKOUT_MS = 15 * 60 * 1000;

@Injectable()
export class SafetyService {
  constructor(
    @InjectModel(SafetyIncident.name) private incidentModel: Model<SafetyIncidentDocument>,
    @InjectModel(SafetyPin.name) private pinModel: Model<SafetyPinDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(GuardianContact.name) private guardianModel: Model<GuardianContactDocument>,
    @InjectModel(GuardianInvite.name) private guardianInviteModel: Model<GuardianInviteDocument>,
    @InjectModel(LocationSession.name) private locationSessionModel: Model<LocationSessionDocument>,
    @InjectModel(SafetyDeliveryAttempt.name) private deliveryAttemptModel: Model<SafetyDeliveryAttemptDocument>,
    @InjectModel(AuditLog.name) private auditLogModel: Model<AuditLogDocument>,
    @InjectModel(UserProfile.name) private profileModel: Model<UserProfileDocument>,
    private readonly notificationsService: NotificationsService,
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

  private async audit(ownerUserId: string, action: string, resourceId?: string) {
    await this.auditLogModel.create({ actorUserId: new Types.ObjectId(ownerUserId), actorRole: 'user', action, module: 'safety', targetResourceId: resourceId, details: action, timestamp: new Date() });
  }

  async listGuardians(ownerUserId: string) {
    const contacts = await this.guardianModel.find({ ownerUserId: new Types.ObjectId(ownerUserId), status: { $ne: 'revoked' } }).select('-__v').sort({ createdAt: -1 }).lean().exec();
    return { success: true, data: contacts, meta: this.meta() };
  }

  async createGuardian(ownerUserId: string, input: { name: string; phoneE164: string; scopes: string[] }) {
    const ownerId = new Types.ObjectId(ownerUserId);
    const count = await this.guardianModel.countDocuments({ ownerUserId: ownerId, status: { $ne: 'revoked' } });
    if (count >= 5) throw new BadRequestException('At most five active guardian contacts are allowed');
    const contact = await this.guardianModel.create({ ownerUserId: ownerId, ...input, status: 'pending' });
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invite = await this.guardianInviteModel.create({ ownerUserId: ownerId, contactId: contact._id, tokenHash, expiresAt: new Date(Date.now() + 7 * 86400000), status: 'pending' });
    await this.audit(ownerUserId, 'GUARDIAN_INVITE_CREATED', contact._id.toString());
    // Do not send or expose the token until an approved delivery and identity-verification flow exists.
    return { success: true, data: { contact, inviteId: invite._id.toString(), status: 'pending', invitationDelivery: 'disabled_pending_approved_channel' }, meta: this.meta() };
  }

  async acceptGuardianInvite(token: string) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const invite = await this.guardianInviteModel.findOne({ tokenHash, status: 'pending', expiresAt: { $gt: new Date() } }).exec();
    if (!invite) throw new NotFoundException('Invitation is invalid or expired');
    // Acceptance alone does not verify identity; no contact is promoted to verified without an approved challenge.
    invite.status = 'accepted'; invite.acceptedAt = new Date(); await invite.save();
    await this.guardianModel.updateOne({ _id: invite.contactId, ownerUserId: invite.ownerUserId, status: 'pending' }, { $set: { acceptedAt: invite.acceptedAt } });
    await this.audit(invite.ownerUserId.toString(), 'GUARDIAN_INVITE_ACCEPTED', invite.contactId.toString());
    return { success: true, data: { status: 'accepted_identity_verification_required' }, meta: this.meta() };
  }

  /**
   * Re-issue a guardian invitation. No message is delivered while the approved
   * channel is unconfigured, so the response states that explicitly; re-issuing
   * is rate-limited in the database to stop invitation spam.
   */
  async resendGuardianInvite(ownerUserId: string, contactId: string) {
    const owner = new Types.ObjectId(ownerUserId);
    const contact = await this.guardianModel.findOne({ _id: new Types.ObjectId(contactId), ownerUserId: owner, status: { $ne: 'revoked' } }).lean().exec();
    if (!contact) throw new NotFoundException('Guardian contact not found');

    // Throttle re-issues, not the original invitation: one per minute per contact.
    if (contact.lastInviteResentAt && contact.lastInviteResentAt.getTime() > Date.now() - 60_000) {
      throw new HttpException(
        { success: false, error: { code: 'GUARDIAN_INVITE_THROTTLED', message: 'An invitation was reissued less than a minute ago. Wait before resending.' } },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    await this.guardianInviteModel.updateMany(
      { contactId: contact._id, status: 'pending' },
      { $set: { status: 'revoked', revokedAt: new Date() } },
    );
    const rawToken = crypto.randomBytes(32).toString('base64url');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const invite = await this.guardianInviteModel.create({
      ownerUserId: owner,
      contactId: contact._id,
      tokenHash,
      expiresAt: new Date(Date.now() + 7 * 86400000),
      status: 'pending',
    });
    await this.guardianModel.updateOne({ _id: contact._id }, { $set: { lastInviteResentAt: new Date() } });
    await this.audit(ownerUserId, 'GUARDIAN_INVITE_REISSUED', contact._id.toString());
    return {
      success: true,
      data: {
        contactId: contact._id.toString(),
        inviteId: invite._id.toString(),
        expiresAt: invite.expiresAt,
        invitationDelivery: 'disabled_pending_approved_channel',
        message: 'Invitation reissued. No message was sent because no approved delivery channel is configured.',
      },
      meta: this.meta(),
    };
  }

  /** Owner-controlled scope change; existing SOS records keep the scopes they used. */
  async updateGuardianScopes(ownerUserId: string, contactId: string, scopes: string[]) {
    const contact = await this.guardianModel.findOneAndUpdate(
      { _id: new Types.ObjectId(contactId), ownerUserId: new Types.ObjectId(ownerUserId), status: { $ne: 'revoked' } },
      { $set: { scopes } },
      { new: true },
    ).lean().exec();
    if (!contact) throw new NotFoundException('Guardian contact not found');
    await this.audit(ownerUserId, 'GUARDIAN_SCOPES_UPDATED', contactId);
    return { success: true, data: { id: contactId, scopes: contact.scopes, status: contact.status }, meta: this.meta() };
  }

  /** PRD `/sos-events/:id`: owner-scoped incident state with delivery evidence. */
  async getSosEvent(userId: string, incidentId: string): Promise<Record<string, unknown>> {
    const owner = new Types.ObjectId(userId);
    const incident = await this.incidentModel.findOne({ _id: new Types.ObjectId(incidentId), userId: owner }).lean().exec();
    if (!incident) throw new NotFoundException('SOS incident not found for this account');
    const attempts = await this.deliveryAttemptModel
      .find({ incidentId: incident._id, ownerUserId: owner })
      .select('guardianContactId channel status failureCode attemptedAt')
      .sort({ attemptedAt: 1, _id: 1 })
      .lean()
      .exec();
    return {
      success: true,
      data: {
        id: incident._id.toString(),
        status: incident.status,
        type: incident.type,
        dispatchStatus: incident.dispatchStatus,
        deliveryConfirmed: attempts.some((attempt) => attempt.status === 'sent'),
        isTestMode: incident.isTestMode,
        triggeredAt: incident.triggeredAt,
        cancelledAt: incident.cancelledAt ?? null,
        recipientCount: incident.trustedContactIds?.length ?? 0,
        attempts: attempts.map((attempt) => ({ ...attempt, id: attempt._id.toString() })),
        note: 'Obiren does not dispatch emergency services. Delivery is only shown as confirmed when a provider returned evidence.',
      },
      meta: this.meta(),
    };
  }

  async revokeGuardian(ownerUserId: string, contactId: string) {
    const contact = await this.guardianModel.findOneAndUpdate({ _id: new Types.ObjectId(contactId), ownerUserId: new Types.ObjectId(ownerUserId), status: { $ne: 'revoked' } }, { $set: { status: 'revoked', revokedAt: new Date() } }, { new: true }).exec();
    if (!contact) throw new NotFoundException('Guardian contact not found');
    await this.guardianInviteModel.updateMany({ contactId: contact._id, status: { $in: ['pending', 'accepted'] } }, { $set: { status: 'revoked', revokedAt: new Date() } });
    await this.audit(ownerUserId, 'GUARDIAN_CONTACT_REVOKED', contactId);
    return { success: true, data: { id: contactId, status: 'revoked' }, meta: this.meta() };
  }

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
        data: { incident: activeSameHour, message: 'SOS incident is already active; no external dispatch is confirmed.' },
        meta: this.meta(),
      };
    }

    const guardians = await this.guardianModel
      .find({ ownerUserId: userObjectId, status: 'verified', scopes: 'sos_alert' })
      .select('_id')
      .lean()
      .exec();

    // There is no approved guardian/SOS delivery channel yet, so every attempt
    // is recorded honestly as skipped (or simulated in test mode). Nothing is
    // ever marked sent without provider evidence.
    const incident = await this.incidentModel.create({
      userId: userObjectId,
      isTestMode: dto.isTestMode,
      dispatchStatus: dto.isTestMode ? 'simulated' : guardians.length > 0 ? 'failed' : 'not_requested',
      trustedContactIds: guardians.map((contact) => contact._id),
      gpsCoordinates: dto.gps,
      notes: dto.notes,
      status: 'active',
      triggeredAt: new Date(),
    });

    const attemptDocs = guardians.map((contact) => ({
      incidentId: incident._id,
      ownerUserId: userObjectId,
      guardianContactId: contact._id,
      channel: 'guardian_alert',
      status: dto.isTestMode ? 'simulated' : 'skipped',
      failureCode: dto.isTestMode ? 'test_mode_no_external_delivery' : 'approved_delivery_channel_not_configured',
      attemptedAt: new Date(),
    }));
    let recordedAttempts = 0;
    if (attemptDocs.length > 0) {
      try {
        const inserted = await this.deliveryAttemptModel.insertMany(attemptDocs);
        recordedAttempts = inserted.length;
      } catch {
        // A bookkeeping failure must never block or fake an SOS response.
        // dispatchStatus already reports that delivery was not confirmed.
        recordedAttempts = 0;
      }
    }

    await this.audit(userId, 'SOS_INCIDENT_CREATED', incident._id.toString());
    return {
      success: true,
      data: {
        incident,
        deliverySummary: {
          recordedAttempts,
          deliveredAttempts: 0,
          status: incident.dispatchStatus,
          note: attemptDocs.length === 0
            ? 'No verified guardian with an SOS scope is registered.'
            : dto.isTestMode
              ? 'Test-mode guardian alerts are simulated and were not delivered.'
              : 'Guardian delivery was not sent because no approved delivery channel is configured.',
        },
        message: dto.isTestMode
          ? 'SOS test drill started. Guardian alerts are simulated in test mode.'
          : 'SOS incident recorded. No emergency dispatch or guardian delivery has been confirmed.',
      },
      meta: this.meta(),
    };
  }

  /**
   * Compatibility view over `getSosEvent`: the delivery list and the SOS event
   * state are read from one implementation so the two can never disagree.
   */
  async getSosDeliveries(userId: string, incidentId: string): Promise<Record<string, unknown>> {
    const event = await this.getSosEvent(userId, incidentId);
    const data = event.data as { attempts: unknown[]; dispatchStatus: string; deliveryConfirmed: boolean };
    return {
      success: true,
      data: {
        incidentId,
        dispatchStatus: data.dispatchStatus,
        deliveryConfirmed: data.deliveryConfirmed,
        attempts: data.attempts,
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
    await this.audit(userId, 'SOS_INCIDENT_CANCELLED', activeIncident._id.toString());

    return {
      success: true,
      data: activeIncident,
      message: 'SOS Panic Session cancelled after Safety PIN verification.',
      meta: this.meta(),
    };
  }

  async startQuietCheckIn(userId: string, input: { checkInAt: string; expiresAt: string }) {
    const incident = await this.incidentModel.create({ userId: new Types.ObjectId(userId), type: 'check_in', status: 'active', dispatchStatus: 'not_requested', triggeredAt: new Date(input.checkInAt), locationExpiresAt: new Date(input.expiresAt) });
    await this.audit(userId, 'QUIET_CHECKIN_CREATED', incident._id.toString());
    return { success: true, data: { id: incident._id.toString(), type: 'check_in', status: 'active', checkInAt: incident.triggeredAt, expiresAt: incident.locationExpiresAt }, meta: this.meta() };
  }

  async startLocationSession(userId: string, expiresAt: string) {
    const profile = await this.profileModel.findOne({ userId: new Types.ObjectId(userId) }).select('timeZone').lean().exec();
    const consent = await this.userModel.db.collection('consent_events').find({ userId: new Types.ObjectId(userId), purpose: 'location_sharing' }).sort({ recordedAt: -1, _id: -1 }).limit(1).next();
    if (!consent?.granted) throw new BadRequestException('Current location-sharing consent is required');
    const session = await this.locationSessionModel.create({ ownerUserId: new Types.ObjectId(userId), startedAt: new Date(), expiresAt: new Date(expiresAt), status: 'active' });
    await this.audit(userId, 'LOCATION_SESSION_CREATED', session._id.toString());
    return { success: true, data: { sessionId: session._id.toString(), status: 'active', expiresAt: session.expiresAt, timeZone: profile?.timeZone || 'UTC' }, meta: this.meta() };
  }

  async updateLocationSession(userId: string, id: string, coordinates: { latitude: number; longitude: number; recordedAt: string }) {
    const incident = await this.locationSessionModel.findOne({ _id: new Types.ObjectId(id), ownerUserId: new Types.ObjectId(userId), status: 'active', expiresAt: { $gt: new Date() } });
    if (!incident) throw new NotFoundException('Active location session not found');
    const sampleAt = new Date(coordinates.recordedAt);
    if (sampleAt > new Date() || sampleAt < incident.startedAt || sampleAt > incident.expiresAt) throw new BadRequestException('Location sample must be within the active session window');
    incident.latitude = coordinates.latitude; incident.longitude = coordinates.longitude; incident.locationRecordedAt = sampleAt;
    await incident.save();
    return { success: true, data: { sessionId: id, recordedAt: coordinates.recordedAt }, meta: this.meta() };
  }

  async revokeLocationSession(userId: string, id: string) {
    const incident = await this.locationSessionModel.findOneAndUpdate({ _id: new Types.ObjectId(id), ownerUserId: new Types.ObjectId(userId), status: 'active' }, { $set: { status: 'revoked' }, $unset: { latitude: 1, longitude: 1, locationRecordedAt: 1 } }, { new: true });
    if (!incident) throw new NotFoundException('Active location session not found');
    await this.audit(userId, 'LOCATION_SESSION_REVOKED', id);
    return { success: true, data: { sessionId: id, status: 'revoked' }, meta: this.meta() };
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
