import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { MongoExceptionFilter } from './common/filters/mongo-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security Headers (PRD Audit Section 14)
  app.use(helmet());

  app.setGlobalPrefix('api/v1');

  // PRD Requirement 6: Global Exception Filter for 409 Duplicate Resource Conflict mapping
  app.useGlobalFilters(new MongoExceptionFilter());

  // PRD Section 9.4 Global DTO Validation Pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`🚀 Obiren Production Monolith API running on http://localhost:${port}/api/v1`);
}

bootstrap();
