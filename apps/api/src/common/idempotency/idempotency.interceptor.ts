import {
  BadRequestException,
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash } from 'crypto';
import type { Response } from 'express';
import { Observable, from, throwError } from 'rxjs';
import { catchError, mergeMap } from 'rxjs/operators';
import { IDEMPOTENT_KEY } from './idempotent.decorator';
import { IdempotencyService } from './idempotency.service';

const SAFE_KEY = /^[A-Za-z0-9._:@-]{8,120}$/;

interface IdempotentRequest {
  method: string;
  path: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  user?: { sub?: string };
  route?: { path?: string };
}

/**
 * Persists and replays transactional POSTs. Only routes annotated with
 * `@Idempotent()` are affected; those routes must send `Idempotency-Key`.
 *
 * Registered *inside* the response-envelope interceptor, so stored payloads
 * are service-level objects and the envelope (with a fresh requestId) is
 * re-applied on replay.
 */
@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly idempotency: IdempotencyService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const required = this.reflector.getAllAndOverride<boolean>(IDEMPOTENT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required) return next.handle();

    const http = context.switchToHttp();
    const req = http.getRequest<IdempotentRequest>();
    const res = http.getResponse<Response>();
    const rawKey = req.headers['idempotency-key'];
    const key = Array.isArray(rawKey) ? rawKey[0] : rawKey;

    if (typeof key !== 'string' || !SAFE_KEY.test(key)) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'IDEMPOTENCY_KEY_REQUIRED',
          message: 'A valid Idempotency-Key header (8-120 URL-safe characters) is required for this operation.',
        },
      });
    }

    const userId = req.user?.sub;
    if (!userId) {
      throw new BadRequestException({
        success: false,
        error: {
          code: 'IDEMPOTENCY_REQUIRES_AUTH',
          message: 'Idempotent operations require an authenticated account.',
        },
      });
    }

    const route = `${req.method} ${req.route?.path ?? req.path}`;
    const requestHash = createHash('sha256')
      .update(`${req.method}\n${req.path}\n${JSON.stringify(req.body ?? {})}`)
      .digest('hex');

    return from(this.idempotency.begin(userId, key, route, requestHash)).pipe(
      mergeMap((begin) => {
        if (begin.state === 'replay') {
          res.status(begin.statusCode);
          return from([begin.body]);
        }
        return next.handle().pipe(
          mergeMap(async (payload) => {
            const body = (payload && typeof payload === 'object' ? payload : { data: payload }) as Record<string, unknown>;
            await this.idempotency.complete(begin.recordId, res.statusCode || 200, body);
            return payload;
          }),
          catchError((error) =>
            from(this.idempotency.release(begin.recordId)).pipe(mergeMap(() => throwError(() => error))),
          ),
        );
      }),
    );
  }
}
