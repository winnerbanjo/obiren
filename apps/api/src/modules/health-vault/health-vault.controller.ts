import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { HealthVaultService } from './health-vault.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SaveVaultDocumentSchema, VaultDocumentIdParam, MongoIdParam } from '../../common/validation/api-schemas';

@ApiTags('Health vault')
@ApiBearerAuth('accessToken')
@UseGuards(JwtAuthGuard)
@Controller('health-vault')
export class HealthVaultController {
  constructor(private readonly healthVaultService: HealthVaultService) {}

  @Post('upload-intent')
  @ApiOperation({ summary: 'Create a signed document-upload intent', description: 'Returns Cloudinary upload parameters; the mobile client uploads the file directly to uploadUrl using the returned apiKey, signature, timestamp, folder, and publicId. The API secret is never exposed. Requires configured storage credentials.' })
  @ApiResponse({ status: 201, description: 'Short-lived upload signature and exact signed parameters.' })
  @ApiResponse({ status: 503, description: 'Document storage is not configured.' })
  async generateUploadIntent(@Req() req: any) {
    return this.healthVaultService.generateUploadIntent(req.user.sub, {});
  }

  @Get('documents')
  @ApiOperation({ summary: 'List health-vault documents', description: 'Returns the authenticated user’s non-deleted document metadata, newest first.' })
  @ApiResponse({ status: 200, description: 'Health-vault document list.' })
  async getDocuments(@Req() req: any) {
    return this.healthVaultService.getDocuments(req.user.sub);
  }

  @Post('documents')
  @ApiOperation({ summary: 'Save uploaded document metadata', description: 'Call after uploading a file with a successful upload intent. Submit the Cloudinary public ID returned/generated for that upload; this endpoint stores metadata and does not upload the file itself.' })
  @ApiBody({ schema: { type: 'object', additionalProperties: false, required: ['title', 'cloudinaryPublicId'], properties: { title: { type: 'string', minLength: 1, maxLength: 200, example: 'October blood test' }, documentType: { type: 'string', enum: ['laboratory_result', 'prescription', 'ultrasound', 'scan', 'referral', 'vaccination', 'medical_note', 'other'], default: 'medical_note' }, cloudinaryPublicId: { type: 'string', minLength: 1, maxLength: 300 }, accessLevel: { type: 'string', enum: ['private', 'shared_with_trusted_circle', 'shared_with_professional'], default: 'private' }, dateOfRecord: { type: 'string', format: 'date' }, healthcareProviderName: { type: 'string', maxLength: 160 }, tags: { type: 'array', maxItems: 20, items: { type: 'string', maxLength: 40 }, default: [] } } } })
  @ApiResponse({ status: 201, description: 'Document metadata saved.' })
  async saveDocument(@Req() req: any, @Body(new ZodValidationPipe(SaveVaultDocumentSchema)) body) {
    return this.healthVaultService.saveDocument(req.user.sub, body);
  }

  @Get('documents/:id')
  @ApiOperation({ summary: 'Create a signed document-download URL', description: 'Returns an owner-only signed URL that expires after five minutes. Do not persist or share the URL; request a new one when needed.' })
  @ApiParam({ name: 'id', description: '24-character document identifier.', example: '66a0b6f3e5f21c8e7a112233' })
  @ApiResponse({ status: 200, description: 'Short-lived signed download URL.' })
  @ApiResponse({ status: 403, description: 'Document belongs to another user.' })
  @ApiResponse({ status: 404, description: 'Document does not exist.' })
  @ApiResponse({ status: 503, description: 'Document storage is not configured.' })
  async getSignedDownloadUrl(@Req() req: any, @Param('id', new ZodValidationPipe(VaultDocumentIdParam)) id: string) {
    return this.healthVaultService.getSignedDownloadUrl(req.user.sub, id);
  }

  @Delete('documents/:id')
  @ApiOperation({ summary: 'Delete a health-vault document', description: 'Soft-deletes the authenticated user’s document metadata. A deleted document can no longer be downloaded.' })
  @ApiParam({ name: 'id', description: '24-character document identifier.', example: '66a0b6f3e5f21c8e7a112233' })
  @ApiResponse({ status: 200, description: 'Document marked deleted.' })
  @ApiResponse({ status: 403, description: 'Document belongs to another user.' })
  @ApiResponse({ status: 404, description: 'Document does not exist.' })
  async deleteDocument(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.healthVaultService.deleteDocument(req.user.sub, id);
  }
}
