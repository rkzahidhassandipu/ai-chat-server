import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { RefreshStrategy } from './strategies/refresh.strategy';
import { EMAIL_QUEUE, EmailQueue } from '@integrations/email/email.queue';
import { BullModule } from '@nestjs/bull';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}), // Configured per-call in service
    BullModule.registerQueue({ name: EMAIL_QUEUE }), // For sending emails on auth events
    
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, RefreshStrategy, EmailQueue],
  exports: [AuthService],
})
export class AuthModule {}
