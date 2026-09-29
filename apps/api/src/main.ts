import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap';
import { env } from './config/env.validation';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';

async function bootstrap() {
  // Fails fast on invalid production configuration.
  const config = env();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Unified security/bootstrap configuration (helmet, CORS, pipes, prefix).
  configureApp(app);

  // PRD Requirement 6: Global Exception Filter for 409 Duplicate Resource Conflict mapping.
  app.useGlobalFilters(new MongoExceptionFilter());

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(
    `🚀 Obiren API [${config.nodeEnv}] running on http://localhost:${config.port}/api/v1 (CORS: ${config.corsOrigins.join(', ')})`,
  );
}

bootstrap();
