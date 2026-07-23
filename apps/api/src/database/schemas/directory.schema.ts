import { Schema, Prop, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type DirectoryServiceDocument = DirectoryService & Document;

@Schema({ timestamps: true, collection: 'directory_services' })
export class DirectoryService {
  @Prop({ required: true, unique: true })
  record_id: string;

  @Prop({ required: true })
  organisation_name: string;

  @Prop({ required: true })
  top_category: string;

  @Prop({ required: true })
  service_category: string;

  @Prop({ required: true })
  country: string;

  @Prop({ required: true, index: true })
  countryCode: string;

  @Prop({ default: 'Nationwide' })
  region: string;

  @Prop({ default: '' })
  city: string;

  @Prop({ default: '' })
  phone: string;

  @Prop({ default: '' })
  whatsapp_or_text: string;

  @Prop({ default: '' })
  email: string;

  @Prop({ required: true })
  service_summary: string;

  @Prop({ default: '24/7' })
  hours: string;

  @Prop({ default: 'Free' })
  cost: string;

  @Prop({ default: 'Government' })
  organisation_type: string;

  @Prop({ default: 'Source verified' })
  verification_status: string;

  @Prop({ default: '' })
  obiren_follow_up: string;

  @Prop({ default: '' })
  source_url: string;

  @Prop({
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
    },
  })
  geoLocation?: {
    type: string;
    coordinates: number[];
  };
}

export const DirectoryServiceSchema = SchemaFactory.createForClass(DirectoryService);
DirectoryServiceSchema.index({ record_id: 1 }, { unique: true });
DirectoryServiceSchema.index({ geoLocation: '2dsphere' });
DirectoryServiceSchema.index({ organisation_name: 'text', service_summary: 'text' });
DirectoryServiceSchema.index({ countryCode: 1, city: 1 });
DirectoryServiceSchema.index({ top_category: 1, verification_status: 1 });
