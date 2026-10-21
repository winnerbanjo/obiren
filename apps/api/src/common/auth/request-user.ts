/**
 * The authenticated principal attached by JwtAuthGuard. Controllers in newer
 * modules use this instead of `any` so a renamed claim fails at compile time.
 */
export interface AuthenticatedUser {
  sub: string;
  email?: string;
  roles?: string[];
}
