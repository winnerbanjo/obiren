import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { HealthVaultController } from './health-vault.controller';
import { HealthVaultService } from './health-vault.service';
import { HealthVaultDoc, HealthVaultDocSchema, HealthVaultAccessLog, HealthVaultAccessLogSchema } from '../../database/schemas/health-vault.schema';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: HealthVaultDoc.name, schema: HealthVaultDocSchema },
      { name: HealthVaultAccessLog.name, schema: HealthVaultAccessLogSchema },
    ]),
    AuthModule,
  ],
  controllers: [HealthVaultController],
  providers: [HealthVaultService],
  exports: [HealthVaultService],
})
export class HealthVaultModule {}
