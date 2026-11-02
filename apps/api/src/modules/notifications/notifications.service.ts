import { Injectable, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import twilio = require('twilio');
import {
  InAppNotification,
  InAppNotificationDocument,
  NotificationOutbox,
  NotificationOutboxDocument,
} from '../../database/schemas/notification.schema';
import { Booking, BookingDocument, Clinician, ClinicianDocument } from '../../database/schemas/care.schema';

@Injectable()
export class NotificationsService {
  constructor(
    @InjectModel(NotificationOutbox.name)
    private outboxModel: Model<NotificationOutboxDocument>,
    @InjectModel(InAppNotification.name)
    private inAppModel: Model<InAppNotificationDocument>,
    @InjectModel(Booking.name)
    private bookingModel: Model<BookingDocument>,
    @InjectModel(Clinician.name)
    private clinicianModel: Model<ClinicianDocument>,
  ) {}

  // PRD Section 22.3 Requirement: Twilio Webhook X-Twilio-Signature validation
  // No auth-token fallback: without TWILIO_AUTH_TOKEN every webhook is rejected.
  verifyTwilioSignature(signature: string, url: string, params: any): boolean {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken || !signature) return false;
    return twilio.validateRequest(authToken, signature, url, params);
  }

  async handleTwilioInbound(payload: any, signature: string, reqUrl: string) {
    const isValid = this.verifyTwilioSignature(signature, reqUrl, payload);
    if (!isValid) {
      throw new ForbiddenException('Invalid Twilio Request Signature (X-Twilio-Signature validation failed).');
    }

    const idempotencyKey = `twilio_inbound_${payload.MessageSid}`;
    await this.outboxModel.updateOne(
      { idempotencyKey },
      {
        $setOnInsert: {
          recipient: { phoneNumber: payload.From },
          type: 'INBOUND_WHATSAPP',
          category: 'SUPPORT',
          channel: 'whatsapp',
          templateKey: 'inbound_message',
          scheduledFor: new Date(),
          status: 'delivered',
          providerMessageId: payload.MessageSid,
          idempotencyKey,
        },
      },
      { upsert: true },
    );

    return {
      success: true,
      status: 'received',
      providerMessageId: payload.MessageSid,
    };
  }

  async handleTwilioStatus(payload: any) {
    const providerMessageId = payload.MessageSid;
    const providerStatus = payload.MessageStatus;

    // PRD Section 22.5: Prevent out-of-order callback downgrades
    const existing = await this.outboxModel.findOne({ providerMessageId });
    if (existing && (existing.status === 'read' || existing.status === 'delivered')) {
      if (providerStatus === 'sent' || providerStatus === 'queued') {
        // Do not downgrade an already delivered/read message
        return { success: true, providerMessageId, mappedStatus: existing.status, ignoredDowngrade: true };
      }
    }

    let status = 'pending';
    if (['sent', 'delivered', 'read'].includes(providerStatus)) {
      status = providerStatus;
    } else if (['undelivered', 'failed'].includes(providerStatus)) {
      status = 'failed';
    }

    await this.outboxModel.updateMany(
      { providerMessageId },
      { $set: { providerStatus, status, deliveredAt: status === 'delivered' ? new Date() : undefined } },
    );

    return {
      success: true,
      providerMessageId,
      mappedStatus: status,
    };
  }

  // PRD Requirement 11: ATOMIC Outbox Claim Worker using findOneAndUpdate to eliminate race conditions
  async processNotificationOutbox() {
    const now = new Date();
    const lockExpiry = new Date(now.getTime() + 5 * 60 * 1000); // 5 minute lock
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    let claimedCount = 0;
    const maxBatch = 20;

    for (let i = 0; i < maxBatch; i++) {
      // Atomic claim via findOneAndUpdate
      const claimedNotif = await this.outboxModel.findOneAndUpdate(
        {
          status: 'pending',
          scheduledFor: { $lte: now },
          $or: [{ lockedUntil: { $exists: false } }, { lockedUntil: { $lt: now } }],
        },
        {
          $set: {
            status: 'processing',
            lockedUntil: lockExpiry,
            workerId,
          },
          $inc: { attemptCount: 1 },
        },
        { new: true },
      );

      if (!claimedNotif) {
        break; // No more pending items to claim
      }

      claimedCount++;

      // Dispatch via Twilio / Mailtrap depending on channel
      if (claimedNotif.channel === 'whatsapp') {
        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;
        if (accountSid && authToken && accountSid.startsWith('AC')) {
          try {
            const client = twilio(accountSid, authToken);
            const msg = await client.messages.create({
              from: process.env.TWILIO_WHATSAPP_FROM || 'whatsapp:+14155238886',
              to: claimedNotif.recipient.phoneNumber || '',
              body: claimedNotif.templateData?.body || 'Obiren Health Reminder Notification',
            });
            claimedNotif.providerMessageId = msg.sid;
            claimedNotif.status = 'sent';
            claimedNotif.sentAt = new Date();
          } catch (err: any) {
            claimedNotif.status = claimedNotif.attemptCount >= claimedNotif.maximumAttempts ? 'failed' : 'pending';
            claimedNotif.failedAt = new Date();
          }
        } else {
          // Never mark an unconfigured external delivery as sent.
          claimedNotif.status = 'failed';
          claimedNotif.failedAt = new Date();
          claimedNotif.providerStatus = 'provider_not_configured';
        }
      } else {
        // Email/SMS providers are not configured; do not claim a delivery succeeded.
        claimedNotif.status = 'failed';
        claimedNotif.failedAt = new Date();
        claimedNotif.providerStatus = 'provider_not_configured';
      }

      await claimedNotif.save();
    }

    return {
      success: true,
      claimedCount,
      processedAt: new Date().toISOString(),
    };
  }

  /**
   * Creates one in-app reminder per confirmed appointment entering the next
   * 24-hour window. `dedupeKey` is unique in the feed, so repeated cron runs
   * (or overlapping deployments) can never duplicate a reminder. No patient or
   * clinical detail is included, and a provider outage cannot affect the
   * appointment itself.
   */
  async processAppointmentReminders() {
    const now = new Date();
    const until = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const bookings = await this.bookingModel
      .find({ status: 'confirmed', startsAt: { $gt: now, $lte: until } })
      .select('_id userId clinicianId startsAt sessionType timeZone')
      .sort({ startsAt: 1 })
      .limit(200)
      .lean()
      .exec();

    let created = 0;
    let skipped = 0;
    for (const booking of bookings) {
      const clinician = await this.clinicianModel
        .findById(booking.clinicianId)
        .select('userId')
        .lean()
        .exec();
      if (!clinician?.userId) {
        skipped += 1;
        continue;
      }
      const timeZone = booking.timeZone || 'UTC';
      let when = booking.startsAt.toISOString();
      try {
        when = new Intl.DateTimeFormat('en-GB', {
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
          timeZone,
        }).format(booking.startsAt);
      } catch {
        // An invalid stored timezone must not stop the reminder batch.
      }

      const result = await this.inAppModel.updateOne(
        { dedupeKey: `doctor_appointment_reminder:${booking._id.toString()}` },
        {
          $setOnInsert: {
            userId: clinician.userId,
            type: 'APPOINTMENT_REMINDER',
            title: 'Upcoming appointment',
            body: `You have a ${booking.sessionType} appointment on ${when} (${timeZone}).`,
            deepLink: `/doctor/appointments/${booking._id.toString()}`,
            objectType: 'booking',
            objectId: booking._id.toString(),
            dedupeKey: `doctor_appointment_reminder:${booking._id.toString()}`,
          },
        },
        { upsert: true },
      );
      if (result.upsertedCount > 0) created += 1;
      else skipped += 1;
    }

    return {
      success: true,
      candidates: bookings.length,
      created,
      skipped,
      processedAt: new Date().toISOString(),
    };
  }

  async queueNotification(dto: any) {
    const idempotencyKey = dto.idempotencyKey || `notif_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const notif = await this.outboxModel.create({
      userId: dto.userId ? new Types.ObjectId(dto.userId) : undefined,
      recipient: dto.recipient,
      type: dto.type || 'HEALTH_REMINDER',
      category: dto.category || 'REMINDER',
      channel: dto.channel || 'whatsapp',
      templateKey: dto.templateKey || 'reminder_default',
      templateData: dto.templateData || {},
      scheduledFor: dto.scheduledFor ? new Date(dto.scheduledFor) : new Date(),
      idempotencyKey,
    });

    return notif;
  }
}
