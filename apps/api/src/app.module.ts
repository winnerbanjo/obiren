import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { env } from './config/env.validation';

import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CyclesModule } from './modules/cycles/cycles.module';
import { PregnancyModule } from './modules/pregnancy/pregnancy.module';
import { DirectoryModule } from './modules/directory/directory.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SafetyModule } from './modules/safety/safety.module';
import { HealthVaultModule } from './modules/health-vault/health-vault.module';
import { AdminModule } from './modules/admin/admin.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Rate Limiting Protection (PRD Section 10.6)
    ThrottlerModule.forRoot([{
      ttl: 60000, // 1 minute
      limit: 30, // 30 requests per minute per IP
    }]),
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: () => ({
        uri: env().mongoUri,
        maxPoolSize: 20,
        minPoolSize: 0,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        retryWrites: true,
      }),
    }),
    AuthModule,
    UsersModule,
    CyclesModule,
    PregnancyModule,
    DirectoryModule,
    NotificationsModule,
    SafetyModule,
    HealthVaultModule,
    AdminModule,
    WaitlistModule,
    HealthModule,
  ],
})
export class AppModule {}
