import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import helmet from 'helmet';
import * as compression from 'compression';
import * as cookieParser from 'cookie-parser';
import { GlobalExceptionFilter } from '@common/filters/global-exception.filter';
import { ResponseInterceptor } from '@common/interceptors/response.interceptor';
import { SocketIoJwtAdapter } from '@modules/chat/socket-jwt.adapter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    bufferLogs: true,
  });

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 5000);
  const clientUrl = configService.get<string>('CLIENT_URL', 'http://localhost:3000');
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  // ─── 1. Adapter সবার আগে ──────────────────────────────────────────────────
  app.useWebSocketAdapter(new SocketIoJwtAdapter(app));

  // ─── 2. Middleware ─────────────────────────────────────────────────────────
  app.use(helmet());
  app.use(
    compression({
      level: 6,
      threshold: 1024,
      filter: (req, res) => {
        if (req.headers['x-no-compression']) return false;
        return compression.filter(req, res);
      },
    }),
  );
  app.use(cookieParser());

  // ─── 3. CORS ───────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
    'http://localhost:3000',
    'http://localhost:3001',
  ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'X-Requested-With'],
  });

  // ─── 4. Global Prefix ──────────────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ─── 5. Pipes ──────────────────────────────────────────────────────────────
  app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
  }),
);

  // ─── 6. Filters & Interceptors ─────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();

  // ─── 7. Listen ─────────────────────────────────────────────────────────────
  await app.listen(port);
  logger.log(`🚀 Server      : http://localhost:${port}/${apiPrefix}`);
  logger.log(`💬 WebSocket   : ws://localhost:${port}/chat`);
  logger.log(`🌍 Environment : ${nodeEnv}`);
  logger.log(`🔗 Client URL  : ${clientUrl}`);
}

bootstrap();