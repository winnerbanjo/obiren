import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import * as cookieParser from 'cookie-parser';
import { env } from '../config/env.validation';

/**
 * Single source of truth for API bootstrap/security configuration.
 * Used by BOTH the normal Nest entrypoint (src/main.ts) and the Vercel
 * serverless entrypoint (api/index.ts) so there is never a secure local
 * bootstrap and an insecure serverless bootstrap.
 */
export function configureApp(app: INestApplication): void {
  const config = env();

  // Security headers (helmet) - identical everywhere.
  app.use(helmet());

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
