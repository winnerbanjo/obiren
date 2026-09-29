import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { HealthVaultService } from './health-vault.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { SaveVaultDocumentSchema, VaultDocumentIdParam, MongoIdParam } from '../../common/validation/api-schemas';

@UseGuards(JwtAuthGuard)
@Controller('health-vault')
export class HealthVaultController {
  constructor(private readonly healthVaultService: HealthVaultService) {}

  @Post('upload-intent')
  async generateUploadIntent(@Req() req: any) {
    return this.healthVaultService.generateUploadIntent(req.user.sub, {});
  }

  @Get('documents')
  async getDocuments(@Req() req: any) {
    return this.healthVaultService.getDocuments(req.user.sub);
  }

  @Post('documents')
  async saveDocument(@Req() req: any, @Body(new ZodValidationPipe(SaveVaultDocumentSchema)) body) {
    return this.healthVaultService.saveDocument(req.user.sub, body);
  }

  @Get('documents/:id')
  async getSignedDownloadUrl(@Req() req: any, @Param('id', new ZodValidationPipe(VaultDocumentIdParam)) id: string) {
    return this.healthVaultService.getSignedDownloadUrl(req.user.sub, id);
  }

  @Delete('documents/:id')
  async deleteDocument(@Req() req: any, @Param('id', new ZodValidationPipe(MongoIdParam)) id: string) {
    return this.healthVaultService.deleteDocument(req.user.sub, id);
  }
}
