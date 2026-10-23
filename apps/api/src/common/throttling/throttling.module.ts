import { ExecutionContext, Injectable, Module, OnApplicationShutdown } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { env } from '../../config/env.validation';
import { RedisThrottlerStorage } from './redis-throttler.storage';

/**
 * Paths that get the strict credential/abuse limits. Matched on POST only so
 * reads of the same resources keep the normal global limit.
 */
const AUTH_SENSITIVE_PATHS = [
  /\/auth\/login$/,
  /\/auth\/google$/,
  /\/auth\/register$/,
  /\/auth\/forgot-password$/,
  /\/auth\/reset-password$/,
  /\/auth\/resend-verification$/,
  /\/auth\/refresh$/,
  /\/safety\/sos\/trigger$/,
  /\/safety\/guardians$/,
  /\/safety\/guardians\/[^/]+\/resend$/,
];

export function isAuthSensitiveRequest(context: ExecutionContext): boolean {
  const request = context.switchToHttp().getRequest<{ method?: string; path?: string; url?: string }>();
  if (request?.method !== 'POST') return false;
  const path = String(request?.path ?? request?.url ?? '').split('?')[0];
  return AUTH_SENSITIVE_PATHS.some((pattern) => pattern.test(path));
}

export function buildThrottlerOptions(storage: ThrottlerStorage): ThrottlerModuleOptions {
  return {
    storage,
    throttlers: [
      {
        name: 'default',
        ttl: () => env().throttle.ttlMs,
        limit: () => env().throttle.limit,
      },
      {
        name: 'auth',
        ttl: () => env().throttle.authTtlMs,
        limit: () => env().throttle.authLimit,
        skipIf: (context: ExecutionContext) => !isAuthSensitiveRequest(context),
      },
    ],
  };
}

const storage = new RedisThrottlerStorage(env().redisUrl);

@Injectable()
class ThrottlerStorageLifecycle implements OnApplicationShutdown {
  async onApplicationShutdown(): Promise<void> {
    await storage.close();
  }
}

/**
 * Global abuse protection. `auth` limits are additional to the global limit,
 * and both are shared through Redis when REDIS_URL is configured.
 */
@Module({
  imports: [ThrottlerModule.forRoot(buildThrottlerOptions(storage))],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    ThrottlerStorageLifecycle,
  ],
})
export class ThrottlingModule {}
