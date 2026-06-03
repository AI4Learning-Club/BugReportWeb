import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { config as loadEnv } from 'dotenv';
import type { NextFunction, Request, Response } from 'express';
import { json, urlencoded, static as expressStatic } from 'express';
import { existsSync } from 'fs';
import { join } from 'path';
import { AppModule } from './app.module';
import { PrismaExceptionFilter } from './prisma/prisma-exception.filter';

const privateNetworkOrigin =
  /^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})(?::\d+)?$/;

function allowedCorsOrigins() {
  return (process.env.FRONTEND_ORIGIN ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function resolveFrontendDist() {
  const candidates = [
    join(process.cwd(), 'frontend', 'dist'),
    join(process.cwd(), '..', 'frontend', 'dist'),
    join(__dirname, '..', '..', 'frontend', 'dist')
  ];

  return candidates.find((candidate) => existsSync(join(candidate, 'index.html')));
}

for (const envPath of [join(process.cwd(), 'backend', '.env'), join(process.cwd(), '.env')]) {
  if (existsSync(envPath)) {
    loadEnv({ path: envPath });
    break;
  }
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalFilters(new PrismaExceptionFilter());
  const configuredOrigins = allowedCorsOrigins();
  app.enableCors((req: Request, callback: (error: Error | null, options?: { origin: boolean; credentials: boolean }) => void) => {
    const origin = req.header('origin');
    const requestHost = req.header('host');

    if (
      !origin ||
      configuredOrigins.includes(origin) ||
      privateNetworkOrigin.test(origin)
    ) {
      callback(null, { origin: true, credentials: true });
      return;
    }

    try {
      if (requestHost && new URL(origin).host === requestHost) {
        callback(null, { origin: true, credentials: true });
        return;
      }
    } catch {
      // Ignore invalid origin values and fall through to the rejection below.
    }

    callback(new Error(`CORS origin not allowed: ${origin}`), {
      origin: false,
      credentials: true
    });
  });
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true }));
  app.use('/uploads', expressStatic(join(process.cwd(), 'uploads')));
  const frontendDist = resolveFrontendDist();
  if (frontendDist) {
    app.use(expressStatic(frontendDist));
    app.use((req: Request, res: Response, next: NextFunction) => {
      const accept = req.header('accept') ?? '';
      const isDocumentRequest =
        req.method === 'GET' &&
        !req.header('authorization') &&
        accept.includes('text/html') &&
        !req.path.startsWith('/uploads') &&
        !req.path.includes('.');

      if (!isDocumentRequest) {
        next();
        return;
      }

      res.sendFile(join(frontendDist, 'index.html'));
    });
  }
  await app.listen(Number(process.env.PORT ?? 3001));
}

bootstrap();
