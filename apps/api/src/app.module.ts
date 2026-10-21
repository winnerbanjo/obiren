import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { env } from './config/env.validation';
import { ApiEnvelopeInterceptor } from './common/http/api-envelope.interceptor';
import { ApiExceptionFilter } from './common/http/api-exception.filter';
import { IdempotencyModule } from './common/idempotency/idempotency.module';
import { IdempotencyInterceptor } from './common/idempotency/idempotency.interceptor';
import { ThrottlingModule } from './common/throttling/throttling.module';
import { MailModule } from './modules/mail/mail.module';

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
import { HomeModule } from './modules/home/home.module';
import { CareModule } from './modules/care/care.module';
import { CommunicationsModule } from './modules/communications/communications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Global rate limiting (Redis-backed when configured) and abuse limits on
    // credential and SOS endpoints.
    ThrottlingModule,
    MailModule,
    IdempotencyModule,
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
    HomeModule,
    CareModule,
    CommunicationsModule,
  ],
  providers: [
    // Envelope runs outermost so idempotency stores service-level payloads and
    // replays receive a fresh requestId.
    { provide: APP_INTERCEPTOR, useClass: ApiEnvelopeInterceptor },
    { provide: APP_INTERCEPTOR, useClass: IdempotencyInterceptor },
    { provide: APP_FILTER, useClass: ApiExceptionFilter },
  ],
})
export class AppModule {}
