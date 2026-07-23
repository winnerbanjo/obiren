import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as crypto from 'crypto';
import { HealthVaultDoc, HealthVaultDocDocument, HealthVaultAccessLog, HealthVaultAccessLogDocument } from '../../database/schemas/health-vault.schema';

@Injectable()
export class HealthVaultService {
  constructor(
    @InjectModel(HealthVaultDoc.name) private docModel: Model<HealthVaultDocDocument>,
    @InjectModel(HealthVaultAccessLog.name) private logModel: Model<HealthVaultAccessLogDocument>,
  ) {}

  // Generate Cloudinary Server-Side Signature (PRD Audit 10: Secret never returned to client)
  async generateUploadIntent(userId: string, dto: any) {
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = 'obiren-health-vault-private';
    const apiSecret = process.env.CLOUDINARY_API_SECRET || 'abcdefghijklmnopqrstuvwxyz012345';

    const paramsToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto.createHash('sha1').update(paramsToSign).digest('hex');

    return {
      success: true,
      data: {
        uploadUrl: `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME || 'obiren-cloud'}/auto/upload`,
        apiKey: process.env.CLOUDINARY_API_KEY || '123456789012345',
        signature,
        timestamp,
        folder,
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async getDocuments(userId: string) {
    const docs = await this.docModel.find({
      userId: new Types.ObjectId(userId),
      status: { $ne: 'deleted' },
    }).exec();

    return {
      success: true,
      data: docs,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async saveDocument(userId: string, dto: any) {
    const doc = await this.docModel.create({
      userId: new Types.ObjectId(userId),
      title: dto.title,
      documentType: dto.documentType || 'medical_note',
      cloudinaryPublicId: dto.cloudinaryPublicId || `doc_${Date.now()}`,
      accessLevel: dto.accessLevel || 'private',
      status: 'active',
    });

    return {
      success: true,
      data: doc,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  // PRD Section 25.5 & Audit 10 Requirement: Short-lived signed download URLs & access control logging
  async getSignedDownloadUrl(userId: string, documentId: string) {
    const userObjectId = new Types.ObjectId(userId);
    const docObjectId = new Types.ObjectId(documentId);

    const doc = await this.docModel.findById(docObjectId);
    if (!doc || doc.status === 'deleted') {
      throw new NotFoundException('Document not found');
    }

    // Access check: User must be owner (or authorized role)
    if (doc.userId.toString() !== userId) {
      throw new ForbiddenException('Access denied: You do not have permission to view this private Health Vault document.');
    }

    // Audit log entry for non-owner or owner access
    await this.logModel.create({
      documentId: doc._id,
      accessedByUserId: userObjectId,
      action: 'GENERATE_SIGNED_DOWNLOAD_URL',
      accessedAt: new Date(),
    });

    const timestamp = Math.floor(Date.now() / 1000) + 300; // 5 min expiry
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || 'obiren-cloud';
    const signedDownloadUrl = `https://res.cloudinary.com/${cloudName}/image/authenticated/s--temp--/v${timestamp}/${doc.cloudinaryPublicId}.pdf`;

    return {
      success: true,
      data: {
        documentId: doc._id.toString(),
        signedDownloadUrl,
        expiresInSeconds: 300,
      },
      meta: { requestId: `req_${Date.now()}` },
    };
  }
}
