import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { EmailService } from './email.service';
import { EMAIL_QUEUE, EmailQueue } from './email.queue';
import { EmailProcessor } from './email.processor';

@Global()
@Module({
  imports: [
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
  providers: [EmailService, EmailQueue, EmailProcessor],
  exports: [EmailService, EmailQueue],
})
export class EmailModule {}