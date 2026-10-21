import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Article, ArticleDocument } from '../../database/schemas/content.schema';
import { requireAdminRole } from '../admin/admin.service';
import { AuthenticatedUser } from '../../common/auth/request-user';

const CONTENT_ROLES = ['super_admin', 'platform_admin', 'content_manager'];
const MEDICAL_REVIEW_ROLES = ['super_admin', 'platform_admin', 'medical_reviewer'];

interface ArticleView {
  _id: Types.ObjectId;
  slug: string;
  title: string;
  summary: string;
  body: string;
  category: string;
  tags?: string[];
  status: string;
  medicalReviewStatus: string;
  reviewedAt?: Date;
  publishedAt?: Date;
  version: number;
}

const CONTENT_DISCLAIMER =
  'Health education only. It does not replace assessment by a qualified clinician.';

@Injectable()
export class ArticlesService {
  constructor(@InjectModel(Article.name) private readonly articleModel: Model<ArticleDocument>) {}

  private meta() {
    return { requestId: `req_${Date.now()}` };
  }

  private present(article: ArticleView, includeBody: boolean) {
    return {
      id: article._id.toString(),
      slug: article.slug,
      title: article.title,
      summary: article.summary,
      ...(includeBody ? { body: article.body } : {}),
      category: article.category,
      tags: article.tags || [],
      status: article.status,
      medicalReviewStatus: article.medicalReviewStatus,
      reviewedAt: article.reviewedAt ?? null,
      publishedAt: article.publishedAt ?? null,
      version: article.version,
      disclaimer: CONTENT_DISCLAIMER,
    };
  }

  async listPublished(query: { category?: string; cursor?: string; limit: number }) {
    const filter: Record<string, unknown> = { status: 'published', publishedAt: { $lte: new Date() } };
    if (query.category) filter.category = query.category;
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.articleModel.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean().exec();
    const hasNext = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    return {
      success: true,
      data: {
        articles: selected.map((article) => this.present(article as unknown as ArticleView, false)),
        nextCursor: hasNext ? selected[selected.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  async getBySlug(slug: string) {
    const article = await this.articleModel
      .findOne({ slug: slug.toLowerCase(), status: 'published' })
      .lean()
      .exec();
    if (!article) throw new NotFoundException('Article not found');
    return { success: true, data: this.present(article as unknown as ArticleView, true), meta: this.meta() };
  }

  async adminList(adminUser: AuthenticatedUser, query: { status?: string; cursor?: string; limit: number }) {
    requireAdminRole(adminUser, [...CONTENT_ROLES, ...MEDICAL_REVIEW_ROLES]);
    const filter: Record<string, unknown> = {};
    if (query.status) filter.status = query.status;
    if (query.cursor) filter._id = { $lt: new Types.ObjectId(query.cursor) };
    const rows = await this.articleModel.find(filter).sort({ _id: -1 }).limit(query.limit + 1).lean().exec();
    const hasNext = rows.length > query.limit;
    const selected = rows.slice(0, query.limit);
    return {
      success: true,
      data: {
        articles: selected.map((article) => this.present(article as unknown as ArticleView, false)),
        nextCursor: hasNext ? selected[selected.length - 1]._id.toString() : null,
      },
      meta: this.meta(),
    };
  }

  async create(
    adminUser: AuthenticatedUser,
    input: { slug: string; title: string; summary: string; body: string; category: string; tags?: string[] },
  ) {
    requireAdminRole(adminUser, CONTENT_ROLES);
    const existing = await this.articleModel.findOne({ slug: input.slug }).lean().exec();
    if (existing) throw new ConflictException('An article with this slug already exists');
    const article = await this.articleModel.create({
      ...input,
      status: 'draft',
      medicalReviewStatus: 'pending',
      authorUserId: new Types.ObjectId(adminUser.sub),
      version: 1,
    });
    return { success: true, data: this.present(article.toObject() as unknown as ArticleView, true), meta: this.meta() };
  }

  /** Editing content invalidates any earlier medical approval. */
  async update(
    adminUser: AuthenticatedUser,
    id: string,
    input: Partial<{ title: string; summary: string; body: string; category: string; tags: string[] }>,
  ) {
    requireAdminRole(adminUser, CONTENT_ROLES);
    const article = await this.articleModel.findById(id);
    if (!article) throw new NotFoundException('Article not found');
    Object.assign(article, input);
    article.version += 1;
    article.medicalReviewStatus = 'pending';
    article.reviewEvidenceRef = undefined;
    article.reviewedAt = undefined;
    article.reviewedByUserId = undefined;
    if (article.status === 'published') {
      article.status = 'draft';
      article.publishedAt = undefined;
    }
    await article.save();
    return { success: true, data: this.present(article.toObject() as unknown as ArticleView, true), meta: this.meta() };
  }

  async review(adminUser: AuthenticatedUser, id: string, input: { medicalReviewStatus: string; reviewEvidenceRef?: string; reviewNote?: string }) {
    requireAdminRole(adminUser, MEDICAL_REVIEW_ROLES);
    const article = await this.articleModel.findById(id);
    if (!article) throw new NotFoundException('Article not found');
    if (input.medicalReviewStatus === 'approved' && !input.reviewEvidenceRef) {
      throw new UnprocessableEntityException('A review evidence reference is required before content can be approved');
    }
    article.medicalReviewStatus = input.medicalReviewStatus;
    if (input.reviewEvidenceRef !== undefined) article.reviewEvidenceRef = input.reviewEvidenceRef;
    if (input.reviewNote !== undefined) article.reviewNote = input.reviewNote;
    article.reviewedAt = new Date();
    article.reviewedByUserId = new Types.ObjectId(adminUser.sub);
    await article.save();
    return { success: true, data: this.present(article.toObject() as unknown as ArticleView, false), meta: this.meta() };
  }

  async publish(adminUser: AuthenticatedUser, id: string) {
    requireAdminRole(adminUser, CONTENT_ROLES);
    const article = await this.articleModel.findById(id);
    if (!article) throw new NotFoundException('Article not found');
    if (article.medicalReviewStatus !== 'approved') {
      throw new UnprocessableEntityException('Content cannot be published before an approved medical review');
    }
    article.status = 'published';
    article.publishedAt = new Date();
    article.archivedAt = undefined;
    await article.save();
    return { success: true, data: this.present(article.toObject() as unknown as ArticleView, false), meta: this.meta() };
  }

  async archive(adminUser: AuthenticatedUser, id: string) {
    requireAdminRole(adminUser, CONTENT_ROLES);
    const article = await this.articleModel.findById(id);
    if (!article) throw new NotFoundException('Article not found');
    article.status = 'archived';
    article.archivedAt = new Date();
    await article.save();
    return { success: true, data: this.present(article.toObject() as unknown as ArticleView, false), meta: this.meta() };
  }
}
