import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/common/bootstrap';
import { env } from '../src/config/env.validation';
import { MongoExceptionFilter } from '../src/common/filters/mongo-exception.filter';

const server = express();
let cachedApp: any = null;

async function bootstrap(): Promise<any> {
  if (cachedApp) {
    return cachedApp;
  }

  // Fails fast on invalid production configuration (serverless cold start).
  env();

  const app = await NestFactory.create(AppModule, new ExpressAdapter(server), {
    bufferLogs: true,
  });

  // THE SAME security/bootstrap configuration as src/main.ts.
  configureApp(app);
  app.useGlobalFilters(new MongoExceptionFilter());

  await app.init();
  cachedApp = server;
  return server;
}

export default async function handler(req: Request, res: Response) {
  const expressApp = await bootstrap();
  return expressApp(req, res);
}
