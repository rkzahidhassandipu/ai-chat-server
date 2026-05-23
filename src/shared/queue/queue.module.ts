import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ConfigService } from '@nestjs/config';

@Global()
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        redis: {
          host: config.get('REDIS_HOST'),
          port: config.get<number>('REDIS_PORT'),
          retryStrategy: (times) => Math.min(times * 100, 3000),
        },
        prefix: 'app-queue',
      }),
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
