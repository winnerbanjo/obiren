import { Body, Controller, Get, Param, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ArticlesService } from './articles.service';
import { AuthenticatedUser } from '../../common/auth/request-user';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { ROLES } from '../../common/auth/roles';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import {
  AdminArticleCreateSchema,
  AdminArticleQuerySchema,
  AdminArticleReviewSchema,
  AdminArticleUpdateSchema,
  ArticleListQuerySchema,
  ArticleSlugParam,
  MongoIdParam,
} from '../../common/validation/api-schemas';

/** Public health education. Only medically approved, published content is served. */
@ApiTags('Articles')
@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Get()
  @ApiOperation({
    summary: 'List published health articles',
    description: 'Cursor-paginated, medically approved content only. Drafts and content awaiting clinical review are never returned.',
  })
  @ApiResponse({ status: 200, description: 'Published articles and next cursor.' })
  async list(@Query(new ZodValidationPipe(ArticleListQuerySchema)) query) {
    return this.articlesService.listPublished(query);
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Read a published article', description: 'Returns the full body of a published, medically approved article, with its content version and disclaimer.' })
  @ApiParam({ name: 'slug', description: 'Article slug.', example: 'understanding-your-cycle' })
  @ApiResponse({ status: 200, description: 'Article body.' })
  @ApiResponse({ status: 404, description: 'No published article has that slug.' })
  async detail(@Param('slug', new ZodValidationPipe(ArticleSlugParam)) slug: string) {
    return this.articlesService.getBySlug(slug);
  }
}

@ApiTags('Admin')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('admin/articles')
export class AdminArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.CONTENT_MANAGER, ROLES.MEDICAL_REVIEWER)
  @Get()
  @ApiOperation({ summary: 'List articles (admin)', description: 'Draft, published and archived content with review state. Requires content, medical-review or administrative role.' })
  @ApiResponse({ status: 200, description: 'Articles and next cursor.' })
  async list(@Req() req: { user: AuthenticatedUser }, @Query(new ZodValidationPipe(AdminArticleQuerySchema)) query) {
    return this.articlesService.adminList(req.user, query);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.CONTENT_MANAGER)
  @Post()
  @ApiOperation({ summary: 'Create an article draft (admin)', description: 'Creates unpublished content with medical review pending. Nothing is visible to users until a medical reviewer approves it and it is published.' })
  @ApiBody({ schema: { type: 'object', required: ['slug', 'title', 'summary', 'body', 'category'], additionalProperties: false, properties: { slug: { type: 'string', maxLength: 120 }, title: { type: 'string', maxLength: 200 }, summary: { type: 'string', maxLength: 600 }, body: { type: 'string', maxLength: 50000 }, category: { type: 'string', maxLength: 60 }, tags: { type: 'array', items: { type: 'string' }, maxItems: 20 } } } })
  @ApiResponse({ status: 201, description: 'Draft created with medical review pending.' })
  @ApiResponse({ status: 409, description: 'Slug already exists.' })
  async create(@Req() req: { user: AuthenticatedUser }, @Body(new ZodValidationPipe(AdminArticleCreateSchema)) body) {
    return this.articlesService.create(req.user, body);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.CONTENT_MANAGER)
  @Put(':id')
  @ApiOperation({ summary: 'Update an article (admin)', description: 'Updating content invalidates any earlier medical approval: the article returns to draft with review pending.' })
  @ApiParam({ name: 'id', description: '24-character article identifier.' })
  @ApiResponse({ status: 200, description: 'Updated article with review reset.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  async update(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(AdminArticleUpdateSchema)) body,
  ) {
    return this.articlesService.update(req.user, id, body);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.MEDICAL_REVIEWER)
  @Put(':id/review')
  @ApiOperation({ summary: 'Record a medical review (admin)', description: 'Records an audited clinical decision. Approval requires a stored evidence reference; a rejected or pending decision cannot be published.' })
  @ApiParam({ name: 'id', description: '24-character article identifier.' })
  @ApiResponse({ status: 200, description: 'Review recorded.' })
  @ApiResponse({ status: 404, description: 'Article not found.' })
  @ApiResponse({ status: 422, description: 'Approval without an evidence reference.' })
  async review(
    @Req() req: { user: AuthenticatedUser },
    @Param('id', new ZodValidationPipe(MongoIdParam)) id: string,
    @Body(new ZodValidationPipe(AdminArticleReviewSchema)) body,
  ) {
    return this.articlesService.review(req.user, id, body);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.CONTENT_MANAGER)
  @Post(':id/publish')
  @ApiOperation({ summary: 'Publish an article (admin)', description: 'Publishes content only after an approved medical review; otherwise returns 422.' })
  @ApiParam({ name: 'id', description: '24-character article identifier.' })
  @ApiResponse({ status: 201, description: 'Article published.' })
  @ApiResponse({ status: 422, description: 'Content has not passed medical review.' })
  async publish(@Req() req: { user: AuthenticatedUser }, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.articlesService.publish(req.user, id);
  }

  @Roles(ROLES.SUPER_ADMIN, ROLES.PLATFORM_ADMIN, ROLES.CONTENT_MANAGER)
  @Post(':id/archive')
  @ApiOperation({ summary: 'Archive an article (admin)', description: 'Removes the article from the public listing while retaining its record.' })
  @ApiParam({ name: 'id', description: '24-character article identifier.' })
  @ApiResponse({ status: 201, description: 'Article archived.' })
  async archive(@Req() req: { user: AuthenticatedUser }, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.articlesService.archive(req.user, id);
  }
}
