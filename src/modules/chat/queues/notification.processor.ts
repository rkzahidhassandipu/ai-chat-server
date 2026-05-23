import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from './notification.queue';

@Processor(NOTIFICATION_QUEUE)
export class NotificationProcessor {
  private readonly logger = new Logger(NotificationProcessor.name);

  @Process(NOTIFICATION_JOBS.NEW_MESSAGE)
  async handleNewMessage(job: Job) {
    const { senderId, receiverId, message, conversationId } = job.data;
    this.logger.log(`🔔 Notification: ${senderId} → ${receiverId}: "${message}"`);
    // এখানে push notification, email পাঠানো যাবে
  }

  @Process(NOTIFICATION_JOBS.MESSAGE_READ)
  async handleMessageRead(job: Job) {
    const { userId, conversationId } = job.data;
    this.logger.log(`✅ Read receipt: ${userId} in ${conversationId}`);
  }
}