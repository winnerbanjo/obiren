import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { env } from '../../config/env.validation';
import { HealthVaultDoc, HealthVaultDocDocument, HealthVaultAccessLog, HealthVaultAccessLogDocument } from '../../database/schemas/health-vault.schema';

@Injectable()
export class HealthVaultService {
  private readonly logger = new Logger(HealthVaultService.name);

  constructor(
    @InjectModel(HealthVaultDoc.name) private docModel: Model<HealthVaultDocDocument>,
    @InjectModel(HealthVaultAccessLog.name) private logModel: Model<HealthVaultAccessLogDocument>,
  ) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  private cloudinaryConfigured(): boolean {
    const c = env().cloudinary;
    return Boolean(c.cloudName && c.apiKey && c.apiSecret);
  }

  /**
   * Genuine Cloudinary upload signature (SHA-1 over alphabetically sorted
   * params + api_secret). Only the signature, timestamp, folder and API key
   * are returned to the client - NEVER the API secret.
   */
  async generateUploadIntent(userId: string, dto: any) {
    if (!this.cloudinaryConfigured()) {
      throw new ServiceUnavailableException(
        'Health Vault storage is not configured. Ask the operator to set Cloudinary credentials.',
      );
    }

    const { cloudName, apiKey, apiSecret } = env().cloudinary;
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = `obiren-health-vault-private/${userId}`;
    const publicId = `doc_${userId}_${timestamp}`;

    // Cloudinary requires params sorted alphabetically, then api_secret appended.
    const paramsToSign = `folder=${folder}&public_id=${publicId}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    await this.logModel.create({
      documentId: null,
      accessedByUserId: new Types.ObjectId(userId),
      action: 'GENERATE_UPLOAD_INTENT',
      accessedAt: new Date(),
    });

    return {
      success: true,
      data: {
        uploadUrl: `https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`,
        apiKey,
        signature,
        timestamp,
        folder,
        publicId,
        // The client must send exactly these params along with the file.
        paramsToSign: { folder, public_id: publicId, timestamp },
      },
      meta: this.meta(),
    };
  }

  async getDocuments(userId: string) {
    const docs = await this.docModel
      .find({ userId: new Types.ObjectId(userId), status: { $ne: 'deleted' } })
      .sort({ createdAt: -1 })
      .exec();

    return { success: true, data: docs, meta: this.meta() };
  }

  async saveDocument(userId: string, dto: any) {
    const doc = await this.docModel.create({
      userId: new Types.ObjectId(userId),
      title: dto.title,
      documentType: dto.documentType || 'medical_note',
      cloudinaryPublicId: dto.cloudinaryPublicId,
      dateOfRecord: dto.dateOfRecord ? new Date(dto.dateOfRecord) : undefined,
      healthcareProviderName: dto.healthcareProviderName,
      tags: dto.tags || [],
      accessLevel: dto.accessLevel || 'private',
      status: 'active',
    });

    return { success: true, data: doc, meta: this.meta() };
  }

  /**
   * Short-lived signed download URL using Cloudinary's authenticated
   * delivery. The token is a real SHA-256 signature over
   * <public_id>-<timestamp> with the API secret, expiring in 5 minutes.
   */
  async getSignedDownloadUrl(userId: string, documentId: string) {
    const { cloudName, apiKey, apiSecret } = env().cloudinary;

    const doc = await this.docModel.findById(documentId);
    if (!doc || doc.status === 'deleted') {
      throw new NotFoundException('Document not found');
    }

    // Ownership check FIRST - unauthorized users must always get 403 and
    // must never learn whether storage is configured.
    if ((doc.userId as Types.ObjectId).toString() !== userId) {
      await this.logModel.create({
        documentId: doc._id,
        accessedByUserId: new Types.ObjectId(userId),
        action: 'DOWNLOAD_DENIED_NOT_OWNER',
        accessedAt: new Date(),
      });
      throw new ForbiddenException('Access denied: You do not have permission to view this document.');
    }

    if (!this.cloudinaryConfigured()) {
      throw new ServiceUnavailableException(
        'Health Vault storage is not configured. Ask the operator to set Cloudinary credentials.',
      );
    }

    const expiresAt = Math.floor(Date.now() / 1000) + 300; // 5 minutes
    const signature = crypto
      .createHash('sha256')
      .update(`${doc.cloudinaryPublicId}-${expiresAt}${apiSecret}`)
      .digest('hex');

    const signedDownloadUrl = `https://res.cloudinary.com/${cloudName}/image/authenticated/s--${signature.slice(0, 16)}--/v${expiresAt}/${doc.cloudinaryPublicId}.pdf?sign=${signature}&expires=${expiresAt}&api_key=${apiKey}`;

    await this.logModel.create({
      documentId: doc._id,
      accessedByUserId: new Types.ObjectId(userId),
      action: 'GENERATE_SIGNED_DOWNLOAD_URL',
      accessedAt: new Date(),
    });

    return {
      success: true,
      data: {
        documentId: doc._id.toString(),
        signedDownloadUrl,
        expiresInSeconds: 300,
      },
      meta: this.meta(),
    };
  }

  async deleteDocument(userId: string, documentId: string) {
    const doc = await this.docModel.findById(documentId);
    if (!doc || doc.status === 'deleted') {
      throw new NotFoundException('Document not found');
    }
    if ((doc.userId as Types.ObjectId).toString() !== userId) {
      throw new ForbiddenException('Access denied: You do not have permission to modify this document.');
    }

    doc.status = 'deleted';
    doc.deletedAt = new Date();
    await doc.save();

    await this.logModel.create({
      documentId: doc._id,
      accessedByUserId: new Types.ObjectId(userId),
      action: 'DELETE_DOCUMENT',
      accessedAt: new Date(),
    });

    return { success: true, data: { documentId: doc._id.toString(), status: 'deleted' }, meta: this.meta() };
  }
}
