import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { VERIFIED_EMERGENCY_DATASET } from '@obiren/localization';
import { DirectoryService, DirectoryServiceDocument } from '../../database/schemas/directory.schema';

@Injectable()
export class DirectoryServiceBackend implements OnModuleInit {
  constructor(
    @InjectModel(DirectoryService.name)
    private directoryModel: Model<DirectoryServiceDocument>,
  ) {}

  async onModuleInit() {
    await this.seedVerifiedRecords();
  }

  async seedVerifiedRecords() {
    const count = await this.directoryModel.countDocuments();
    if (count === 0) {
      console.log('Seeding 31 Verified Emergency Records into MongoDB Atlas...');
      const recordsToInsert = VERIFIED_EMERGENCY_DATASET.map((r) => ({
        ...r,
        geoLocation: {
          type: 'Point',
          coordinates: r.countryCode === 'NG' ? [3.3792, 6.5244] : r.countryCode === 'GB' ? [-0.1278, 51.5074] : r.countryCode === 'US' ? [-77.0369, 38.9072] : [-0.187, 5.6037],
        },
      }));
      await this.directoryModel.insertMany(recordsToInsert);
      console.log('Seeded 31 Verified Emergency Directory Records cleanly.');
    }
  }

  async search(params: {
    q?: string;
    countryCode?: string;
    category?: string;
    page?: number;
    limit?: number;
  }) {
    const q = (params.q || '').trim();
    const countryCode = params.countryCode;
    const page = params.page || 1;
    const limit = params.limit || 20;

    const filter: any = {};
    if (countryCode && countryCode !== 'ALL') {
      filter.countryCode = countryCode;
    }
    if (params.category) {
      filter.top_category = { $regex: params.category.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&'), $options: 'i' };
    }

    if (q) {
      const escaped = q.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
      filter.$or = [
        { organisation_name: { $regex: escaped, $options: 'i' } },
        { top_category: { $regex: escaped, $options: 'i' } },
        { service_summary: { $regex: escaped, $options: 'i' } },
      ];
    }

    const [results, total] = await Promise.all([
      this.directoryModel.find(filter).skip((page - 1) * limit).limit(limit).exec(),
      this.directoryModel.countDocuments(filter),
    ]);

    return {
      success: true,
      data: results,
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
        requestId: `req_${Date.now()}`,
      },
    };
  }

  async getServiceById(recordId: string) {
    const found = await this.directoryModel.findOne({ record_id: recordId });
    return {
      success: true,
      data: found || null,
      meta: { requestId: `req_${Date.now()}` },
    };
  }

  async getNearby(lng?: number, lat?: number, maxDistanceMeters = 50000, limit = 20) {
    if (!lng || !lat) {
      const fallback = await this.directoryModel.find().limit(10).exec();
      return {
        success: true,
        data: fallback,
        meta: { requestId: `req_${Date.now()}` },
      };
    }

    // PRD Section 16.4 & Audit 7 Requirement: Real GeoJSON 2dsphere $near query
    const results = await this.directoryModel
      .find({
        geoLocation: {
          $near: {
            $geometry: { type: 'Point', coordinates: [Number(lng), Number(lat)] },
            $maxDistance: Number(maxDistanceMeters),
          },
        },
      })
      .limit(limit)
      .exec();

    return {
      success: true,
      data: results,
      meta: { total: results.length, requestId: `req_${Date.now()}` },
    };
  }
}
