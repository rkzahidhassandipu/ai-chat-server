import { Processor, Process, OnQueueFailed } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';
import { EmailService } from './email.service';
import { EMAIL_QUEUE, EmailJob } from './email.queue';

@Processor(EMAIL_QUEUE)
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  constructor(private emailService: EmailService) {}

  @Process(EmailJob.SEND_RESET)
  async handleReset(job: Job<{ email: string; token: string }>) {
    await this.emailService.sendPasswordReset(job.data.email, job.data.token);
    this.logger.log(`✅ Reset email → ${job.data.email}`);
  }

  @Process(EmailJob.SEND_VERIFY)
  async handleVerify(job: Job<{ email: string; token: string }>) {
    await this.emailService.sendEmailVerification(job.data.email, job.data.token);
    this.logger.log(`✅ Verify email → ${job.data.email}`);
  }

  @Process(EmailJob.SEND_WELCOME)
  async handleWelcome(job: Job<{ email: string; name: string }>) {
    await this.emailService.sendWelcome(job.data.email, job.data.name);
    this.logger.log(`✅ Welcome email → ${job.data.email}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(
      `❌ Job failed: ${job.name} | attempt ${job.attemptsMade}/3`,
      error.message,
    );
  }
}