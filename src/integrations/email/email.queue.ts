import { InjectQueue } from '@nestjs/bull';
import { Injectable } from '@nestjs/common';
import { Queue } from 'bull';

export const EMAIL_QUEUE = 'email';

export enum EmailJob {
  SEND_RESET   = 'send-reset',
  SEND_VERIFY  = 'send-verify',
  SEND_WELCOME = 'send-welcome',
}

@Injectable()
export class EmailQueue {
  constructor(
    @InjectQueue(EMAIL_QUEUE) private queue: Queue,
  ) {}

  async sendPasswordReset(email: string, token: string) {
    return this.queue.add(EmailJob.SEND_RESET, { email, token });
  }

  async sendVerification(email: string, token: string) {
    return this.queue.add(EmailJob.SEND_VERIFY, { email, token });
  }

  async sendWelcome(email: string, name: string) {
    return this.queue.add(EmailJob.SEND_WELCOME, { email, name });
  }
}