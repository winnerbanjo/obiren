import { randomUUID } from 'crypto';
import type { NextFunction, Request, Response } from 'express';

const INCOMING_HEADER = 'x-request-id';
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{8,128}$/;

/**
 * Assigns a request identifier to every request, echoes it in the response
 * header, and exposes it on `req.requestId` for the envelope interceptor and
 * exception filter. Untrusted inbound values are length/charset checked.
 */
export type RequestWithId = Request & { requestId?: string };

export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers[INCOMING_HEADER];
  const candidate = Array.isArray(incoming) ? incoming[0] : incoming;
  const requestId = typeof candidate === 'string' && SAFE_REQUEST_ID.test(candidate)
    ? candidate
    : `req_${randomUUID()}`;

  (req as RequestWithId).requestId = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

export function getRequestId(req: { requestId?: unknown } | null | undefined, fallbackPrefix = 'req'): string {
  return typeof req?.requestId === 'string' ? req.requestId : `${fallbackPrefix}_${randomUUID()}`;
}
