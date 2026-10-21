import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { getRequestId } from './request-id.middleware';

/**
 * Normalises every successful response to the PRD envelope:
 *
 *   { data: <payload>, meta?: <metadata>, requestId: <id> }
 *
 * Existing handlers return a service-level shape (`{ success, data, meta }`,
 * or a bare object). `success` is dropped, extra top-level keys are preserved
 * under `meta`, and the per-request identifier replaces the old per-service
 * `meta.requestId`.
 */
@Injectable()
export class ApiEnvelopeInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const requestId = getRequestId(context.switchToHttp().getRequest());
    return next.handle().pipe(
      map((payload) => {
        if (payload === undefined || payload === null) {
          return { data: null, requestId };
        }

        if (typeof payload !== 'object' || Array.isArray(payload)) {
          return { data: payload, requestId };
        }

        const body = payload as Record<string, unknown>;
        const hasEnvelopeShape = Object.prototype.hasOwnProperty.call(body, 'data') || body.success === true;
        if (!hasEnvelopeShape) {
          return { data: body, requestId };
        }

        const rawMeta = (body.meta && typeof body.meta === 'object' ? body.meta : {}) as Record<string, unknown>;
        const meta: Record<string, unknown> = { ...rawMeta };
        delete meta.requestId;
        // Preserve legacy top-level extras (e.g. a `message`) without leaking
        // them into the PRD `data` payload.
        for (const [key, value] of Object.entries(body)) {
          if (key === 'success' || key === 'data' || key === 'meta') continue;
          meta[key] = value;
        }

        return {
          data: body.data === undefined ? null : body.data,
          ...(Object.keys(meta).length > 0 ? { meta } : {}),
          requestId,
        };
      }),
    );
  }
}
