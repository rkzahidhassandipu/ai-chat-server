import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter;

  constructor(private configService: ConfigService) {
    this.transporter = nodemailer.createTransport({
      host: this.configService.get<string>('MAIL_HOST'),
      port: this.configService.get<number>('MAIL_PORT', 587),
      secure: this.configService.get<string>('MAIL_SECURE') === 'true',
      auth: {
        user: this.configService.get<string>('MAIL_USER'),
        pass: this.configService.get<string>('MAIL_PASS'),
      },
    });
  }

  // ─── Core Send ────────────────────────────────────────────────────────────────
  async sendMail(options: SendMailOptions): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.get<string>('MAIL_FROM', 'AI Chat <no-reply@aichat.com>'),
        to: options.to,
        subject: options.subject,
        html: options.html,
      });
      this.logger.log(`📧 Email sent → ${options.to}`);
    } catch (err) {
      this.logger.error(`❌ Email failed → ${options.to}`, err);
      // Non-blocking — don't crash the request
    }
  }

  // ─── Templates ───────────────────────────────────────────────────────────────

  async sendPasswordReset(email: string, token: string): Promise<void> {
    const clientUrl = this.configService.get<string>('CLIENT_URL', 'https://ai-chat-client-vkh3.onrender.com');
    const resetUrl = `${clientUrl}/reset-password?token=${token}`;

    await this.sendMail({
      to: email,
      subject: '🔐 Reset Your Password — AI Chat',
      html: this.buildResetTemplate(resetUrl),
    });
  }

  async sendEmailVerification(email: string, token: string): Promise<void> {
    const clientUrl = this.configService.get<string>('CLIENT_URL', 'https://ai-chat-client-vkh3.onrender.com');
    const verifyUrl = `${clientUrl}/verify-email?token=${token}`;

    await this.sendMail({
      to: email,
      subject: '✉️ Verify Your Email — AI Chat',
      html: this.buildVerifyTemplate(verifyUrl),
    });
  }

  async sendWelcome(email: string, name: string): Promise<void> {
    await this.sendMail({
      to: email,
      subject: '👋 Welcome to AI Chat!',
      html: this.buildWelcomeTemplate(name),
    });
  }

  // ─── HTML Templates ───────────────────────────────────────────────────────────

  private baseLayout(title: string, color: string, body: string): string {
    return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8"/>
      <style>
        * { box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f5f5f5; margin: 0; padding: 0; }
        .wrapper { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.08); }
        .header { background: ${color}; padding: 36px 32px; text-align: center; }
        .header h1 { color: #fff; margin: 0; font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }
        .body { padding: 36px 32px; color: #333; line-height: 1.7; font-size: 15px; }
        .btn { display: inline-block; background: ${color}; color: #fff !important; text-decoration: none; padding: 14px 36px; border-radius: 8px; font-weight: 600; font-size: 15px; margin: 24px 0; }
        .note { background: #fef9ec; border-left: 4px solid #f59e0b; padding: 12px 16px; border-radius: 6px; font-size: 13px; color: #555; }
        .footer { text-align: center; padding: 24px; font-size: 12px; color: #aaa; border-top: 1px solid #f0f0f0; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header"><h1>${title}</h1></div>
        <div class="body">${body}</div>
        <div class="footer">© ${new Date().getFullYear()} AI Chat. All rights reserved.</div>
      </div>
    </body>
    </html>`;
  }

  private buildResetTemplate(resetUrl: string): string {
    return this.baseLayout('🔐 Password Reset', '#6366f1', `
      <p>Hi there,</p>
      <p>We received a request to reset your password. Click the button below to set a new one:</p>
      <div style="text-align:center"><a href="${resetUrl}" class="btn">Reset Password</a></div>
      <div class="note">⚠️ This link expires in <strong>1 hour</strong>. If you didn't request this, ignore this email.</div>
      <p style="margin-top:20px;font-size:13px;color:#999">Or copy: <a href="${resetUrl}">${resetUrl}</a></p>
    `);
  }

  private buildVerifyTemplate(verifyUrl: string): string {
    return this.baseLayout('✉️ Verify Your Email', '#10b981', `
      <p>Hi there,</p>
      <p>Thanks for signing up! Please verify your email address to activate your account:</p>
      <div style="text-align:center"><a href="${verifyUrl}" class="btn">Verify Email</a></div>
      <p style="font-size:13px;color:#999">This link expires in 24 hours.</p>
    `);
  }

  private buildWelcomeTemplate(name: string): string {
    return this.baseLayout('👋 Welcome to AI Chat!', '#6366f1', `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Your account is ready! You can now start using AI-powered chat with real-time translation.</p>
      <p>Enjoy the experience 🚀</p>
    `);
  }
}
