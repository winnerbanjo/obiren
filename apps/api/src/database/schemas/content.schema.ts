import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

/**
 * Health-education content. Publishing requires a recorded medical review with
 * evidence; editing the body resets that review so unreviewed copy can never
 * stay published.
 */
export type ArticleDocument = Article & Document;

@Schema({ timestamps: true, collection: 'articles' })
export class Article {
  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 120 })
  slug: string;

  @Prop({ type: String, required: true, trim: true, maxlength: 200 })
  title: string;

  @Prop({ type: String, required: true, maxlength: 600 })
  summary: string;

  @Prop({ type: String, required: true, maxlength: 50000 })
  body: string;

  @Prop({ type: String, required: true, maxlength: 60, index: true })
  category: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ type: String, required: true, enum: ['draft', 'published', 'archived'], default: 'draft', index: true })
  status: string;

  @Prop({ type: String, required: true, enum: ['pending', 'approved', 'rejected'], default: 'pending' })
  medicalReviewStatus: string;

  @Prop({ type: String, maxlength: 300 })
  reviewEvidenceRef?: string;

  @Prop({ type: String, maxlength: 500 })
  reviewNote?: string;

  @Prop({ type: Types.ObjectId, ref: 'User' })
  reviewedByUserId?: Types.ObjectId;

  @Prop({ type: Date })
  reviewedAt?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  authorUserId: Types.ObjectId;

  @Prop({ type: Date })
  publishedAt?: Date;

  @Prop({ type: Date })
  archivedAt?: Date;

  @Prop({ type: Number, default: 1 })
  version: number;
}

export const ArticleSchema = SchemaFactory.createForClass(Article);
ArticleSchema.index({ status: 1, publishedAt: -1 }, { name: 'idx_article_published' });
ArticleSchema.index({ category: 1, status: 1 }, { name: 'idx_article_category_status' });
