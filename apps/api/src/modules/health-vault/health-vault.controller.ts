import { Controller, Get, Post, Body, Param, Req, UseGuards } from '@nestjs/common';
import { HealthVaultService } from './health-vault.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('health-vault')
export class HealthVaultController {
  constructor(private readonly healthVaultService: HealthVaultService) {}

  @Post('upload-intent')
  async generateUploadIntent(@Req() req: any, @Body() body: any) {
    return this.healthVaultService.generateUploadIntent(req.user.sub, body);
  }

  @Get('documents')
  async getDocuments(@Req() req: any) {
    return this.healthVaultService.getDocuments(req.user.sub);
  }

  @Post('documents')
  async saveDocument(@Req() req: any, @Body() body: any) {
    return this.healthVaultService.saveDocument(req.user.sub, body);
  }

  @Get('documents/:id')
  async getSignedDownloadUrl(@Req() req: any, @Param('id') id: string) {
    return this.healthVaultService.getSignedDownloadUrl(req.user.sub, id);
  }
}
