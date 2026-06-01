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
  const clientUrl = configService.get<string>(
    'CLIENT_URL',
    'https://ai-chat-client-ew1l.onrender.com',
  );
  const apiPrefix = configService.get<string>('API_PREFIX', 'api/v1');
  const nodeEnv = configService.get<string>('NODE_ENV', 'production');

  // ─── 1. WebSocket Adapter ─────────────────────────────────────────────────
  app.useWebSocketAdapter(new SocketIoJwtAdapter(app));

  // ─── 2. Helmet (configured — default blocks iframes & cross-origin) ────────
  app.use(
    helmet({
      // Allow the frontend to load the app in a frame from the same origin
      frameguard: { action: 'sameorigin' },

      // CSP: allow scripts/styles/connections from our own origins only
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
          fontSrc: ["'self'", 'data:'],
          connectSrc: [
            "'self'",
            clientUrl,                                      // frontend origin
            'https://ai-chat-server-l2bo.onrender.com',    // backend itself
            'wss://ai-chat-server-l2bo.onrender.com',      // WebSocket (wss)
          ],
          frameSrc: ["'self'", clientUrl],
          frameAncestors: ["'self'", clientUrl],
        },
      },

      // Required for cookies over HTTPS on Render
      hsts: {
        maxAge: 31536000,
        includeSubDomains: true,
        preload: true,
      },

      crossOriginEmbedderPolicy: false,   // keeps SharedArrayBuffer off — avoids blocking fetch
      crossOriginResourcePolicy: { policy: 'cross-origin' }, // allow Cloudinary images etc.
      crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' }, // needed for Google OAuth popup
    }),
  );

  // ─── 3. Compression ───────────────────────────────────────────────────────
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

  // ─── 4. Cookie Parser ─────────────────────────────────────────────────────
  app.use(cookieParser());

  // ─── 5. CORS ──────────────────────────────────────────────────────────────
  app.enableCors({
    origin: [
      'https://ai-chat-client-ew1l.onrender.com',
      ...(nodeEnv === 'development' ? ['https://ai-chat-client-ew1l.onrender.com'] : []),
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Cookie',
    ],
    exposedHeaders: ['Set-Cookie'],
  });

  // ─── 6. Global Prefix ─────────────────────────────────────────────────────
  app.setGlobalPrefix(apiPrefix);

  // ─── 7. Validation Pipe ───────────────────────────────────────────────────
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: true,
    }),
  );

  // ─── 8. Filters & Interceptors ────────────────────────────────────────────
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.enableShutdownHooks();

  // ─── 9. Listen ────────────────────────────────────────────────────────────
  await app.listen(port, '0.0.0.0');   // '0.0.0.0' required on Render
  logger.log(`🚀 Server      : http://localhost:${port}/${apiPrefix}`);
  logger.log(`💬 WebSocket   : wss://ai-chat-server-l2bo.onrender.com/chat`);
  logger.log(`🌍 Environment : ${nodeEnv}`);
  logger.log(`🔗 Client URL  : ${clientUrl}`);
}

bootstrap();