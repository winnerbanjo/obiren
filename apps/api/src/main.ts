import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp } from './common/bootstrap';
import { env } from './config/env.validation';

async function bootstrap() {
  // Fails fast on invalid production configuration.
  const config = env();

  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  // Unified security/bootstrap configuration (helmet, CORS, pipes, prefix).
  configureApp(app);

  await app.listen(config.port);
  // eslint-disable-next-line no-console
  console.log(
    `🚀 Obiren API [${config.nodeEnv}] running on http://localhost:${config.port}/api/v1 (CORS: ${config.corsOrigins.join(', ')})`,
  );
}

bootstrap();
