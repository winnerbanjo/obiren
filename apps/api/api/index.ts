import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import express, { Request, Response } from 'express';
import { AppModule } from '../src/app.module';

const server = express();
let cachedApp: any = null;

async function bootstrap(): Promise<any> {
  if (cachedApp) {
    return cachedApp;
  }

  const app = await NestFactory.create(
    AppModule,
    new ExpressAdapter(server),
    {
      bufferLogs: true,
    },
  );

  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  await app.init();
  cachedApp = server;
  return server;
}

export default async function handler(req: Request, res: Response) {
  const expressApp = await bootstrap();
  return expressApp(req, res);
}
