/**
 * Verification/reset tokens may be echoed in API responses for local
 * development and automated tests only. Anything else - including staging and
 * production - must deliver them exclusively by email. The allow-list is
 * positive (never `!== 'production'`) so an unexpected NODE_ENV fails closed.
 */
const TOKEN_EXPOSURE_ENVS = new Set(['development', 'test']);

export function shouldExposeDevTokens(nodeEnv: string | undefined = process.env.NODE_ENV): boolean {
  return typeof nodeEnv === 'string' && TOKEN_EXPOSURE_ENVS.has(nodeEnv);
}
