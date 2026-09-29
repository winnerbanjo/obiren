import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthVaultController } from './health-vault.controller';
import { HealthVaultService } from './health-vault.service';
import { JwtAuthModule } from '../../common/guards/jwt-auth.module';
import { HealthVaultDoc, HealthVaultDocSchema, HealthVaultAccessLog, HealthVaultAccessLogSchema } from '../../database/schemas/health-vault.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HealthVaultDoc.name, schema: HealthVaultDocSchema },
      { name: HealthVaultAccessLog.name, schema: HealthVaultAccessLogSchema },
    ]),
    JwtAuthModule,
  ],
  controllers: [HealthVaultController],
  providers: [HealthVaultService],
})
export class HealthVaultModule {}
