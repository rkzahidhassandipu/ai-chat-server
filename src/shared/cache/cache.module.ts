import { Global, Module } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';
import { ConfigService } from '@nestjs/config';
import { redisStore } from 'cache-manager-ioredis-yet';

@Global()
@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (config: ConfigService) => ({
        store: await redisStore({
          socket: {
            host: config.get('REDIS_HOST'),
            port: config.get<number>('REDIS_PORT'),
          },
          password: config.get('REDIS_PASSWORD') || undefined,
        }),
        ttl: config.get<number>('REDIS_TTL', 60),
      }),
    }),
  ],
  exports: [CacheModule],
})
export class AppCacheModule {}
