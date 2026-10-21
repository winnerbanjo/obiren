import { SetMetadata } from '@nestjs/common';

export const IDEMPOTENT_KEY = 'obiren:idempotent';

/**
 * Marks a route as requiring an `Idempotency-Key` header. The interceptor
 * replays the stored response for the same key/body and rejects key reuse with
 * a different payload.
 */
export const Idempotent = () => SetMetadata(IDEMPOTENT_KEY, true);
