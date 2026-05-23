import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log: [
        { emit: 'stdout', level: 'warn' },
        { emit: 'stdout', level: 'error' },
      ],
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
      this.logger.log('✅ Database connected');
    } catch (err) {
      this.logger.error('❌ Database connection failed', err);
      throw err;
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('🔌 Database disconnected');
  }

  /**
   * Exclude sensitive fields from an entity before returning it
   * Usage: prisma.exclude(user, ['password', 'resetToken'])
   */
  exclude<T extends object, K extends keyof T>(entity: T, keys: K[]): Omit<T, K> {
    return Object.fromEntries(
      Object.entries(entity).filter(([k]) => !keys.includes(k as K)),
    ) as Omit<T, K>;
  }
}
