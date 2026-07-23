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

  async search(params: any) {
    const q = (params.q || '').trim();
    const countryCode = params.countryCode;

    const filter: any = {};
    if (countryCode && countryCode !== 'ALL') {
      filter.countryCode = countryCode;
    }

    if (q) {
      filter.$or = [
        { organisation_name: { $regex: q, $options: 'i' } },
        { top_category: { $regex: q, $options: 'i' } },
        { service_summary: { $regex: q, $options: 'i' } },
      ];
    }

    const results = await this.directoryModel.find(filter).exec();

    return {
      success: true,
      data: results,
      meta: {
        total: results.length,
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

  async getNearby(lng?: number, lat?: number, maxDistanceMeters = 50000) {
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
      .exec();

    return {
      success: true,
      data: results,
      meta: { total: results.length, requestId: `req_${Date.now()}` },
    };
  }
}
