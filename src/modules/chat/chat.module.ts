import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatController } from './chat.controller';
import { ChatRepository } from './chat.repository';
import { DatabaseModule } from '@core/database/prisma.module';
import { NOTIFICATION_QUEUE } from './queues/notification.queue';
import { NotificationProcessor } from './queues/notification.processor';
import { TranslationService } from './translation.service';

@Module({
  imports: [
    DatabaseModule,
    BullModule.registerQueue({ name: NOTIFICATION_QUEUE }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '15m') },
      }),
    }),
  ],
  controllers: [ChatController],
  providers: [
    ChatGateway,
    ChatService,
    ChatRepository,
    NotificationProcessor,
    TranslationService,
  ],
  exports: [ChatGateway, ChatService, JwtModule],
})
export class ChatModule {}