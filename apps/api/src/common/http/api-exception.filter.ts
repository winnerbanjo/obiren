import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { codeForStatus, ERROR_CODES } from './error-codes';
import { getRequestId } from './request-id.middleware';

interface NormalisedError {
  code: string;
  message: string;
  details?: unknown;
}

/**
 * Single global exception filter implementing the PRD error envelope:
 *
 *   { error: { code, message, details? }, requestId }
 *
 * Never serialises request bodies, health data, or provider payloads. Only
 * the HTTP status and a stable code are logged for 5xx responses.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();
    const requestId = getRequestId(request);

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let normalised: NormalisedError = {
      code: ERROR_CODES.INTERNAL_SERVER_ERROR,
      message: 'An unexpected internal server error occurred.',
    };

    const mongoError = exception as { code?: unknown; name?: unknown } | null;
    if (mongoError?.code === 11000 || (mongoError?.name === 'MongoServerError' && mongoError?.code === 11000)) {
      status = HttpStatus.CONFLICT;
      normalised = {
        code: ERROR_CODES.CONFLICT,
        message: 'A resource with this unique key already exists.',
      };
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      normalised = this.normaliseHttpException(exception, status);
    }

    response.setHeader('X-Request-Id', requestId);
    response.status(status).json({ error: normalised, requestId });

    // Privacy-safe operational log: method/path/status/code only.
    if (status >= 500) {
      this.logger.error(`${request?.method ?? 'UNKNOWN'} ${request?.originalUrl ?? ''} -> ${status} ${normalised.code}`);
    }
  }

  private normaliseHttpException(exception: HttpException, status: number): NormalisedError {
    const payload = exception.getResponse();

    if (typeof payload === 'string') {
      return { code: this.codeFor(payload, status), message: payload };
    }

    if (payload && typeof payload === 'object') {
      const body = payload as Record<string, unknown>;

      // Services throw `{ success:false, error:{ code, message, details|fields } }`.
      if (body.error && typeof body.error === 'object') {
        const errorBody = body.error as Record<string, unknown>;
        const details = errorBody.details as { fields?: unknown } | undefined;
        const fields = errorBody.fields ?? details?.fields;
        return {
          code: typeof errorBody.code === 'string' ? errorBody.code : codeForStatus(status),
          message: typeof errorBody.message === 'string' ? errorBody.message : this.defaultMessage(status),
          ...(fields ? { details: { fields } } : errorBody.details !== undefined ? { details: errorBody.details } : {}),
        };
      }

      const rawMessage = body.message;
      const message = Array.isArray(rawMessage)
        ? rawMessage.join('; ')
        : typeof rawMessage === 'string'
          ? rawMessage
          : this.defaultMessage(status);

      const details = body.details ?? (Array.isArray(rawMessage) ? { issues: rawMessage } : undefined);
      return {
        code: codeForStatus(status),
        message: this.stripFrameworkPrefix(message),
        ...(details !== undefined ? { details } : {}),
      };
    }

    return { code: codeForStatus(status), message: this.defaultMessage(status) };
  }

  private codeFor(message: string, status: number): string {
    // ThrottlerException and Nest guard messages map to PRD codes.
    if (status === HttpStatus.TOO_MANY_REQUESTS) return ERROR_CODES.RATE_LIMITED;
    if (/throttl/i.test(message)) return ERROR_CODES.RATE_LIMITED;
    return codeForStatus(status);
  }

  private stripFrameworkPrefix(message: string): string {
    return message.replace(/^ThrottlerException:\s*/, '');
  }

  private defaultMessage(status: number): string {
    switch (status) {
      case 400:
        return 'Request validation failed.';
      case 401:
        return 'Authentication is required.';
      case 403:
        return 'You do not have permission to perform this action.';
      case 404:
        return 'The requested resource was not found.';
      case 409:
        return 'The request conflicts with the current resource state.';
      case 422:
        return 'The resource is not in a valid state for this action.';
      case 429:
        return 'Too many requests. Please retry later.';
      case 503:
        return 'A required provider is unavailable.';
      default:
        return 'An unexpected internal server error occurred.';
    }
  }
}
