import { Controller, ExecutionContext, INestApplication, Post } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as request from 'supertest';
import { ApiExceptionFilter } from '../src/common/http/api-exception.filter';
import { ApiEnvelopeInterceptor } from '../src/common/http/api-envelope.interceptor';
import { requestIdMiddleware } from '../src/common/http/request-id.middleware';
import { RedisThrottlerStorage } from '../src/common/throttling/redis-throttler.storage';
import { isAuthSensitiveRequest } from '../src/common/throttling/throttling.module';

@Controller('probe')
class ProbeController {
  @Post()
  hit() {
    return { success: true, data: { ok: true } };
  }
}

function fakeContext(method: string, path: string) {
  return {
    switchToHttp: () => ({ getRequest: () => ({ method, path }) }),
  } as unknown as ExecutionContext;
}

describe('Rate limiting', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [ProbeController],
      providers: [
        { provide: APP_GUARD, useClass: ThrottlerGuard },
        { provide: APP_FILTER, useClass: ApiExceptionFilter },
        { provide: APP_INTERCEPTOR, useClass: ApiEnvelopeInterceptor },
      ],
    }).compile();

    app = moduleRef.createNestApplication({ logger: false });
    app.use(requestIdMiddleware);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('blocks the request over the configured limit with RATE_LIMITED and no sensitive detail', async () => {
    const server = app.getHttpServer();
    await request(server).post('/probe').expect(201);
    await request(server).post('/probe').expect(201);
    const blocked = await request(server).post('/probe').expect(429);

    expect(blocked.body.error.code).toBe('RATE_LIMITED');
    expect(typeof blocked.body.requestId).toBe('string');
    expect(blocked.headers['retry-after']).toBeTruthy();
  });

  it('applies strict limits only to credential, guardian and SOS POSTs', () => {
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/auth/login'))).toBe(true);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/auth/register'))).toBe(true);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/auth/forgot-password'))).toBe(true);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/auth/reset-password'))).toBe(true);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/auth/refresh'))).toBe(true);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/safety/guardians'))).toBe(true);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/safety/guardians/abc/resend'))).toBe(true);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/safety/sos/trigger'))).toBe(true);

    expect(isAuthSensitiveRequest(fakeContext('GET', '/api/v1/auth/login'))).toBe(false);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/cycles/start-period'))).toBe(false);
    expect(isAuthSensitiveRequest(fakeContext('POST', '/api/v1/users/me/export'))).toBe(false);
  });

  it('uses an in-memory fallback with correct block semantics when Redis is not configured', async () => {
    const storage = new RedisThrottlerStorage(undefined);
    const first = await storage.increment('probe', 60_000, 2, 60_000);
    const second = await storage.increment('probe', 60_000, 2, 60_000);
    const third = await storage.increment('probe', 60_000, 2, 60_000);

    expect(first.isBlocked).toBe(false);
    expect(second.isBlocked).toBe(false);
    expect(third.isBlocked).toBe(true);
    expect(third.timeToBlockExpire).toBeGreaterThan(0);
    await storage.close();
  });
});
