import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { NotificationOutbox, NotificationOutboxDocument } from '../../database/schemas/notification.schema';
import { NotificationPreference, NotificationPreferenceDocument, HealthShare, HealthShareDocument, Consultation, ConsultationDocument, Message, MessageDocument, Device, DeviceDocument, Attachment, AttachmentDocument } from '../../database/schemas/communications.schema';
import { decryptHealthNote, encryptHealthNote } from '../../common/crypto/health-data-crypto';
import { UserProfile, UserProfileDocument } from '../../database/schemas/user.schema';
import { Cycle, CycleDocument, DailyLog, DailyLogDocument } from '../../database/schemas/cycle.schema';
import { Pregnancy, PregnancyDocument } from '../../database/schemas/pregnancy.schema';
import { ConsentEvent, ConsentDocument } from '../../database/schemas/consent.schema';

@Injectable()
export class CommunicationsService {
  constructor(
    @InjectModel(NotificationOutbox.name) private readonly outbox: Model<NotificationOutboxDocument>,
    @InjectModel(NotificationPreference.name) private readonly preferenceModel: Model<NotificationPreferenceDocument>,
    @InjectModel(HealthShare.name) private readonly shareModel: Model<HealthShareDocument>,
    @InjectModel(UserProfile.name) private readonly profileModel: Model<UserProfileDocument>,
    @InjectModel(Cycle.name) private readonly cycleModel: Model<CycleDocument>,
    @InjectModel(DailyLog.name) private readonly dailyLogModel: Model<DailyLogDocument>,
    @InjectModel(Pregnancy.name) private readonly pregnancyModel: Model<PregnancyDocument>,
    @InjectModel(ConsentEvent.name) private readonly consentModel: Model<ConsentDocument>,
    @InjectModel(Consultation.name) private readonly consultationModel: Model<ConsultationDocument>,
    @InjectModel(Message.name) private readonly messageModel: Model<MessageDocument>,
    @InjectModel(Device.name) private readonly deviceModel: Model<DeviceDocument>,
    @InjectModel(Attachment.name) private readonly attachmentModel: Model<AttachmentDocument>,
  ) {}
  private meta() { return { requestId: `req_${Date.now()}` }; }

  async getPreferences(userId: string) {
    const preference = await this.preferenceModel.findOne({ userId: new Types.ObjectId(userId) }).lean().exec();
    return { success: true, data: preference || { inAppEnabled: true, emailEnabled: false, smsEnabled: false, discreetMode: false, disabledCategories: [] }, meta: this.meta() };
  }

  async updatePreferences(userId: string, update: Record<string, unknown>) {
    const preference = await this.preferenceModel.findOneAndUpdate({ userId: new Types.ObjectId(userId) }, { $set: update, $setOnInsert: { userId: new Types.ObjectId(userId) } }, { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }).lean().exec();
    return { success: true, data: preference, meta: this.meta() };
  }

  async listInbox(userId: string, cursor?: string, limit = 30) {
    const id = new Types.ObjectId(userId);
    const preference = await this.preferenceModel.findOne({ userId: id }).lean().exec();
    if (preference?.inAppEnabled === false) return { success: true, data: { notifications: [], nextCursor: null }, meta: this.meta() };
    const filter: Record<string, unknown> = { userId: id, channel: 'in_app', status: { $nin: ['cancelled'] } };
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };
    if (preference?.disabledCategories?.length) filter.category = { $nin: preference.disabledCategories };
    const rows = await this.outbox.find(filter).sort({ _id: -1 }).limit(limit + 1).lean().exec();
    const hasNext = rows.length > limit; const selected = rows.slice(0, limit);
    const discreet = preference?.discreetMode !== false;
    const notifications = selected.map((item) => ({ id: item._id.toString(), category: item.category, status: item.status, createdAt: (item as any).createdAt, ...(discreet ? { title: 'You have a new update', body: 'Open the app to view your update.' } : { title: item.templateData?.title || 'Update', body: item.templateData?.body || 'Open the app to view your update.' }) }));
    return { success: true, data: { notifications, nextCursor: hasNext ? selected[selected.length - 1]._id.toString() : null }, meta: this.meta() };
  }

  async createHealthShare(ownerUserId: string, input: { recipientUserId: string; scopes: string[]; from: string; to: string; expiresAt: string }) {
    if (ownerUserId === input.recipientUserId) throw new BadRequestException('A separate recipient account is required');
    const consent = await this.consentModel.find({ userId: new Types.ObjectId(ownerUserId), purpose: 'health_sharing' }).sort({ recordedAt: -1, _id: -1 }).limit(1).lean().exec();
    if (!consent[0]?.granted) throw new NotFoundException('Current health-sharing consent is required');
    const recipient = await this.profileModel.findOne({ userId: new Types.ObjectId(input.recipientUserId) }).select('userId').lean().exec();
    if (!recipient) throw new NotFoundException('Recipient account not found');
    const owner = new Types.ObjectId(ownerUserId);
    const cycles = input.scopes.includes('cycles') ? await this.cycleModel.find({ userId: owner, startedAt: { $gte: new Date(`${input.from}T00:00:00.000Z`), $lte: new Date(`${input.to}T23:59:59.999Z`) } }).select('startedAt periodEndedAt periodLength cycleLength status').lean().exec() : [];
    const logs = input.scopes.includes('daily_logs') ? await this.dailyLogModel.find({ userId: owner, date: { $gte: input.from, $lte: input.to } }).select('date bleeding pain moods symptoms').lean().exec() : [];
    const pregnancies = input.scopes.includes('pregnancy') ? await this.pregnancyModel.find({ userId: owner }).select('status estimatedDueDate calculationSource dateConfidence').lean().exec() : [];
    const snapshot: Record<string, unknown> = { cycles, logs, pregnancies, disclaimer: 'User-approved data snapshot; not medical advice.' };
    const expiresAt = new Date(input.expiresAt);
    const share = await this.shareModel.create({ ownerUserId: owner, recipientUserId: new Types.ObjectId(input.recipientUserId), scopes: input.scopes, evidenceFrom: input.from, evidenceTo: input.to, redactedSnapshot: snapshot, expiresAt, consentedAt: new Date() });
    return { success: true, data: { id: share._id.toString(), scopes: share.scopes, evidenceFrom: share.evidenceFrom, evidenceTo: share.evidenceTo, expiresAt: share.expiresAt, status: 'active' }, meta: this.meta() };
  }

  async getReceivedShares(recipientUserId: string) {
    const rows = await this.shareModel.find({ recipientUserId: new Types.ObjectId(recipientUserId), expiresAt: { $gt: new Date() }, revokedAt: { $exists: false } }).sort({ createdAt: -1 }).limit(50).lean().exec();
    return { success: true, data: rows.map((share) => ({ id: share._id.toString(), ownerUserId: share.ownerUserId.toString(), scopes: share.scopes, evidenceFrom: share.evidenceFrom, evidenceTo: share.evidenceTo, expiresAt: share.expiresAt, data: share.redactedSnapshot })), meta: this.meta() };
  }

  async revokeHealthShare(ownerUserId: string, shareId: string) {
    const share = await this.shareModel.findOneAndUpdate({ _id: new Types.ObjectId(shareId), ownerUserId: new Types.ObjectId(ownerUserId), revokedAt: { $exists: false } }, { $set: { revokedAt: new Date() } }, { new: true });
    if (!share) throw new NotFoundException('Active health share not found');
    return { success: true, data: { id: shareId, status: 'revoked' }, meta: this.meta() };
  }

  // ---------------- Consultations and encrypted messages ----------------

  /**
   * Membership is enforced from the bearer token: non-participants get the same
   * 404 as a missing conversation so consultation existence is not disclosed.
   */
  private async requireMembership(userId: string, consultationId: string): Promise<ConsultationDocument> {
    const consultation = await this.consultationModel.findOne({
      _id: new Types.ObjectId(consultationId),
      participantUserIds: new Types.ObjectId(userId),
    }).exec();
    if (!consultation) throw new NotFoundException('Consultation not found for this account');
    return consultation;
  }

  private serializeMessage(message: Record<string, any>, viewerUserId?: string) {
    let body: string;
    try {
      body = decryptHealthNote({ ciphertext: message.ciphertext, iv: message.iv, authTag: message.authTag, keyId: message.keyId });
    } catch {
      throw new BadRequestException('A consultation message could not be decrypted');
    }
    return {
      id: message._id.toString(),
      consultationId: message.consultationId.toString(),
      senderUserId: message.senderUserId.toString(),
      body,
      status: message.status,
      deliveredAt: message.deliveredAt ?? null,
      readAt: message.readAt ?? null,
      createdAt: message.createdAt,
      isOwnMessage: viewerUserId ? message.senderUserId.toString() === viewerUserId : undefined,
    };
  }

  async listConsultations(userId: string, cursor?: string, limit = 20) {
    const filter: Record<string, unknown> = { participantUserIds: new Types.ObjectId(userId) };
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };
    const rows = await this.consultationModel
      .find(filter)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select('patientUserId clinicianUserId status lastMessageAt closedAt createdAt')
      .lean()
      .exec();
    const hasNext = rows.length > limit;
    const selected = rows.slice(0, limit);
    return {
      success: true,
      data: {
        consultations: selected.map((row) => ({
          id: row._id.toString(),
          role: row.patientUserId.toString() === userId ? 'patient' : 'clinician',
          status: row.status,
          lastMessageAt: row.lastMessageAt,
          closedAt: row.closedAt ?? null,
          createdAt: (row as any).createdAt,
        })),
        nextCursor: hasNext ? selected[selected.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  async listMessages(userId: string, consultationId: string, cursor?: string, limit = 30) {
    const consultation = await this.requireMembership(userId, consultationId);
    const filter: Record<string, unknown> = { consultationId: consultation._id };
    if (cursor) filter._id = { $lt: new Types.ObjectId(cursor) };
    const rows = await this.messageModel.find(filter).sort({ _id: -1 }).limit(limit + 1).lean().exec();
    const hasNext = rows.length > limit;
    const selected = rows.slice(0, limit);
    // Fetching is client evidence of delivery; read state requires an explicit ack.
    const deliveredAt = new Date();
    const newlyDelivered = selected
      .filter((row) => row.senderUserId.toString() !== userId && row.status === 'sent')
      .map((row) => row._id);
    if (newlyDelivered.length > 0) {
      await this.messageModel.updateMany({ _id: { $in: newlyDelivered } }, { $set: { status: 'delivered', deliveredAt } });
      for (const row of selected) {
        if (newlyDelivered.some((id) => id.equals(row._id))) {
          row.status = 'delivered';
          row.deliveredAt = deliveredAt;
        }
      }
    }
    return {
      success: true,
      data: {
        consultationId,
        messages: selected.map((row) => this.serializeMessage(row, userId)),
        nextCursor: hasNext ? selected[selected.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  async postMessage(userId: string, consultationId: string, body: string) {
    const consultation = await this.requireMembership(userId, consultationId);
    if (consultation.status !== 'open') throw new ConflictException('This consultation is closed and no longer accepts messages');
    const encrypted = encryptHealthNote(body);
    const message = await this.messageModel.create({
      consultationId: consultation._id,
      senderUserId: new Types.ObjectId(userId),
      ciphertext: encrypted.ciphertext,
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      keyId: encrypted.keyId,
      status: 'sent',
    });
    await this.consultationModel.updateOne({ _id: consultation._id }, { $set: { lastMessageAt: new Date() } });
    return {
      success: true,
      data: this.serializeMessage({ ...message.toObject(), createdAt: (message as any).createdAt }, userId),
      meta: this.meta(),
    };
  }

  async acknowledgeMessages(userId: string, consultationId: string) {
    const consultation = await this.requireMembership(userId, consultationId);
    const result = await this.messageModel.updateMany(
      { consultationId: consultation._id, senderUserId: { $ne: new Types.ObjectId(userId) }, status: { $in: ['sent', 'delivered'] } },
      { $set: { status: 'read', readAt: new Date() } },
    );
    return { success: true, data: { consultationId, markedRead: result.modifiedCount }, meta: this.meta() };
  }

  // ---------------- Consultation attachments ----------------

  private attachmentView(attachment: Record<string, any>, includeStorage: boolean) {
    return {
      id: attachment._id.toString(),
      consultationId: attachment.consultationId.toString(),
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      scanStatus: attachment.scanStatus,
      downloadAvailable: Boolean(attachment.available),
      createdAt: attachment.createdAt,
      ...(includeStorage ? { storagePublicId: attachment.storagePublicId } : {}),
    };
  }

  /**
   * Registers an attachment that the client already stored. Scanning is not
   * configured, so the record is explicitly unavailable for download rather
   * than pretending a safety check happened.
   */
  async createAttachment(
    userId: string,
    consultationId: string,
    input: { fileName: string; contentType: string; sizeBytes: number; storagePublicId: string },
  ) {
    const consultation = await this.requireMembership(userId, consultationId);
    if (consultation.status !== 'open') throw new ConflictException('This consultation is closed and accepts no new attachments');
    const attachment = await this.attachmentModel.create({
      consultationId: consultation._id,
      uploaderUserId: new Types.ObjectId(userId),
      fileName: input.fileName,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
      storagePublicId: input.storagePublicId,
      scanStatus: 'not_configured',
      available: false,
    });
    return {
      success: true,
      data: {
        ...this.attachmentView(attachment.toObject() as Record<string, any>, true),
        downloadAvailable: false,
        message: 'Attachment metadata stored. Download stays disabled until malware scanning is configured.',
      },
      meta: this.meta(),
    };
  }

  async listAttachments(userId: string, consultationId: string) {
    const consultation = await this.requireMembership(userId, consultationId);
    const rows = await this.attachmentModel
      .find({ consultationId: consultation._id })
      .sort({ _id: -1 })
      .limit(50)
      .lean()
      .exec();
    return {
      success: true,
      data: { consultationId, attachments: rows.map((row) => this.attachmentView(row as Record<string, any>, false)) },
      meta: this.meta(),
    };
  }

  /** Fail closed: no attachment leaves storage before an approved scan exists. */
  async getAttachmentDownload(userId: string, attachmentId: string) {
    const attachment = await this.attachmentModel.findById(attachmentId).lean().exec();
    if (!attachment) throw new NotFoundException('Attachment not found');
    await this.requireMembership(userId, attachment.consultationId.toString());
    if (!attachment.available || attachment.scanStatus !== 'clean') {
      throw new ServiceUnavailableException(
        'Attachment downloads are disabled until malware scanning is configured. The file has not been released.',
      );
    }
    throw new ServiceUnavailableException('Attachment delivery is not enabled in this deployment.');
  }

  // ---------------- Notification devices ----------------

  private deviceView(device: Record<string, any>) {
    return {
      id: device._id.toString(),
      platform: device.platform,
      deviceName: device.deviceName ?? null,
      status: device.status,
      lastSeenAt: device.lastSeenAt,
      createdAt: device.createdAt,
    };
  }

  async registerDevice(userId: string, input: { platform: string; token: string; deviceName?: string }) {
    const tokenHash = crypto.createHash('sha256').update(input.token).digest('hex');
    const owner = new Types.ObjectId(userId);
    const existing = await this.deviceModel.findOne({ tokenHash }).select('+tokenHash').lean().exec();
    if (existing && existing.userId.toString() !== userId) {
      throw new ConflictException('This device token is already registered to another account');
    }
    const device = await this.deviceModel.findOneAndUpdate(
      { tokenHash },
      {
        $set: { userId: owner, platform: input.platform, deviceName: input.deviceName, status: 'active', lastSeenAt: new Date() },
        $unset: { revokedAt: 1 },
        $setOnInsert: { tokenHash },
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).select('-tokenHash').lean().exec();
    return { success: true, data: this.deviceView(device as any), meta: this.meta() };
  }

  async listDevices(userId: string) {
    const devices = await this.deviceModel.find({ userId: new Types.ObjectId(userId) }).select('-tokenHash').sort({ lastSeenAt: -1 }).limit(50).lean().exec();
    return { success: true, data: devices.map((device) => this.deviceView(device as any)), meta: this.meta() };
  }

  async revokeDevice(userId: string, id: string) {
    const device = await this.deviceModel.findOneAndUpdate(
      { _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), status: 'active' },
      { $set: { status: 'revoked', revokedAt: new Date() } },
      { new: true },
    ).select('-tokenHash').lean().exec();
    if (!device) throw new NotFoundException('Active device not found for this account');
    return { success: true, data: { id, status: 'revoked' }, meta: this.meta() };
  }

  async markRead(userId: string, id: string) {
    const result = await this.outbox.updateOne({ _id: new Types.ObjectId(id), userId: new Types.ObjectId(userId), channel: 'in_app', status: { $in: ['sent', 'delivered', 'read'] } }, { $set: { status: 'read', readAt: new Date() } });
    if (!result.matchedCount) throw new NotFoundException('Notification not found for this account');
    return { success: true, data: { id, status: 'read' }, meta: this.meta() };
  }

}
