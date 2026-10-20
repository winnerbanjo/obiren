import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import cookieParser = require('cookie-parser');
import { env } from '../config/env.validation';

/**
 * Single source of truth for API bootstrap/security configuration.
 * Used by BOTH the normal Nest entrypoint (src/main.ts) and the Vercel
 * serverless entrypoint (api/index.ts) so there is never a secure local
 * bootstrap and an insecure serverless bootstrap.
 */
export function configureApp(app: INestApplication): void {
  const config = env();

  // Keep Helmet's default CSP everywhere, relaxing only script execution on
  // Swagger UI routes because Swagger UI includes its generated inline loader.
  app.use((req, res, next) => {
    const path = req.path;
    // Accept a trailing sentence period when a link is copied from prose.
    // The reported 404 was for /api/v1/docs. (including the final period).
    if (path === '/api/v1/docs.') {
      return res.redirect(308, req.originalUrl.replace('/api/v1/docs.', '/api/v1/docs'));
    }
    const isSwaggerRoute =
      path === '/api/v1/docs' ||
      path.startsWith('/api/v1/docs/') ||
      path === '/api/v1/docs-json';
    return helmet({
      contentSecurityPolicy: isSwaggerRoute
        ? { directives: { scriptSrc: ["'self'", "'unsafe-inline'"] } }
        : undefined,
    })(req, res, next);
  });

  // Cookie parsing for the HTTP-only refresh-token cookie.
  app.use(cookieParser());

  // Global route prefix / versioning.
  app.setGlobalPrefix('api/v1');

  // CORS: explicit allow-list. Never '*' combined with credentials.
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Cron-Secret', 'X-Twilio-Signature'],
  });

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Obiren API')
    .setDescription([
      '## Overview',
      'Versioned REST API for the Obiren mobile and web clients. All routes below are relative to `/api/v1`.',
      '',
      '## Mobile authentication flow',
      '1. Create an account with `POST /auth/register`, then verify the email address with `POST /auth/verify-email`.',
      '2. Sign in with `POST /auth/login` and `platform: ios` or `android`. Store the short-lived access token securely.',
      '3. Send protected requests with `Authorization: Bearer <accessToken>`. Access tokens expire after 15 minutes.',
      '4. Renew with `POST /auth/refresh` using the refresh token in the JSON body (mobile clients) or the `obiren_refresh` cookie (browser clients). Refresh tokens rotate; replace the stored token after each successful refresh. Lifetime: 30 days.',
      '5. Revoke the session with `POST /auth/logout` when signing out.',
      '',
      '## Conventions',
      '- Request and response bodies use JSON unless an endpoint explicitly says otherwise. Unknown request fields are rejected.',
      '- Calendar dates use `YYYY-MM-DD`; timestamps are ISO 8601.',
      '- Successful responses generally use `{ success, data, meta }`; `meta.requestId` can be used for support and troubleshooting. Some simple endpoints return a smaller success object.',
      '- Errors use an appropriate HTTP status. Validation errors include `message` and `statusCode`; domain errors may additionally include a stable `error.code`.',
      '- Protected operations require the access-token bearer scheme. Refresh-token cookies are `HttpOnly` and are intended for browser clients; native clients should send the refresh token in the request body.',
      '- `Admin`, `Notifications and webhooks`, and internal cron operations are operational integrations, not ordinary mobile-client endpoints.',
    ].join('\n'))
    .setVersion('1.0.0')
    .setOpenAPIVersion('3.1.0')
    .addServer('/api/v1', 'API v1 (same origin)')
    .addTag('Authentication', 'Account registration, sign-in, token rotation, and email/password recovery.')
    .addTag('Users', 'The authenticated user profile and personal-data lifecycle.')
    .addTag('Cycles', 'Authenticated menstrual-cycle tracking and cycle history. Predictions are estimates, not contraception advice.')
    .addTag('Daily logs', 'Date-keyed daily cycle symptoms and observations.')
    .addTag('Pregnancy', 'Authenticated pregnancy profile, gestational progress, and symptom logging.')
    .addTag('Directory', 'Public search for health and emergency services; results can be filtered or located nearby.')
    .addTag('Safety', 'Safety PIN controls and SOS incident operations. Triggering a live SOS can notify trusted contacts.')
    .addTag('Health vault', 'Private health-document metadata and short-lived signed upload/download flows.')
    .addTag('Health', 'Service liveness endpoint.')
    .addTag('Waitlist', 'Public early-access signup and restricted operational views.')
    .addTag('Admin', 'Privileged administrative operations; requires an administrative role in addition to a bearer token.')
    .addTag('Notifications and webhooks', 'Provider callbacks and internal notification processing; not intended for mobile clients.')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'accessToken',
    )
    .addCookieAuth('obiren_refresh', { type: 'apiKey', in: 'cookie' }, 'refreshCookie')
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig, {
    ignoreGlobalPrefix: true,
  });
  SwaggerModule.setup('docs', app, swaggerDocument, {
    useGlobalPrefix: true,
    raw: ['json'],
    customSiteTitle: 'Obiren API — Swagger UI',
    swaggerOptions: { persistAuthorization: true },
  });

  // Global pipes: whitelist + reject unknown fields, implicit conversions.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  app.enableShutdownHooks();
}
