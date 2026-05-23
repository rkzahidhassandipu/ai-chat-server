import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';

// Core
import { DatabaseModule } from '@core/database/prisma.module';
import { AppConfig } from '@core/config/app.config';
import { envValidation } from '@core/config/env.config';

// Integrations
import { EmailModule } from '@integrations/email/email.module';

// Modules
import { AppController } from './app.controller';
import { AuthModule } from '@modules/auth/auth.module';
import { UsersModule } from '@modules/users/users.module';
import { RedisModule } from '@shared/redis/redis.module';
import { AppCacheModule } from '@shared/cache/cache.module';
import { QueueModule } from '@shared/queue/queue.module';
import { StorageModule } from '@integrations/storage/storage.module';
import { ChatModule } from '@modules/chat/chat.module';

@Module({
  imports: [
    // ─── Config ───────────────────────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      validate: envValidation,
      load: [AppConfig],
      envFilePath: ['.env'],
    }),

    // ─── Rate Limiting ─────────────────────────────────────────────────────────
    ThrottlerModule.forRoot([
      { name: 'short', ttl: 1000, limit: 5 },
      { name: 'medium', ttl: 60000, limit: 60 },
      { name: 'long', ttl: 3600000, limit: 200 },
    ]),

    // ─── Core Infrastructure ───────────────────────────────────────────────────
    DatabaseModule,

    // ─── Shared Modules ───────────────────────────────────────────────────────────────
    RedisModule,
    AppCacheModule,
    QueueModule,
    ChatModule,

    // ─── Integrations ──────────────────────────────────────────────────────────
    EmailModule,

    // ─── Storage ─────────────────────────────────────────────────────────────
    StorageModule,

    // ─── Business Modules ──────────────────────────────────────────────────────
    AuthModule,
    UsersModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
