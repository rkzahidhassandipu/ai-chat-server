import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import { EmailService } from '@integrations/email/email.service';
import { hashPassword, comparePassword } from '@common/utils/bcrypt.util';
import {
  generateSecureToken,
  expiresInMs,
  ONE_HOUR_MS,
  SEVEN_DAYS_MS,
} from '@common/utils/token.util';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { EmailQueue } from '@integrations/email/email.queue';

// Fields returned for the current user
const SAFE_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  bio: true,
  role: true,
  status: true,
  isActive: true,
  isEmailVerified: true,
  preferredLanguage: true,
  lastSeen: true,
  createdAt: true,
  updatedAt: true,
};

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private emailQueue: EmailQueue,
  ) {}

  // ─── Register ─────────────────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) throw new ConflictException('An account with this email already exists');

    const password = await hashPassword(dto.password);
    const emailVerifyToken = generateSecureToken();

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password,
        avatar: dto.avatar ?? null,
        preferredLanguage: dto.preferredLanguage ?? 'en',
        emailVerifyToken,
      },
      select: SAFE_USER_SELECT,
    });

    // Fire & forget emails
    this.emailQueue.sendVerification(user.email, emailVerifyToken).catch(
      (e) => this.logger.error('Verification email failed', e),
    );
    this.emailQueue.sendWelcome(user.email, user.name).catch(
      (e) => this.logger.error('Welcome email failed', e),
    );

    this.logger.log(`Registered: ${user.email}`);
    return { message: 'Registration successful. Please verify your email.', data: user };
  }

  // ─── Login ────────────────────────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });

    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!user.isActive) throw new UnauthorizedException('Account has been deactivated');

    const valid = await comparePassword(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid email or password');

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    await this.prisma.refreshToken.create({
      data: {
        token: tokens.refreshToken,
        userId: user.id,
        expiresAt: expiresInMs(SEVEN_DAYS_MS),
      },
    });

    if(!user.isEmailVerified) {
      throw new UnauthorizedException(`Please verify your email before logging in. Check your inbox: ${user.email}`);
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: { status: 'ONLINE', lastSeen: new Date() },
    });

    const { password, resetToken, resetTokenExpiry, emailVerifyToken, ...safe } = user;

    this.logger.log(`Login: ${user.email}`);
    return {
      message: 'Login successful',
      data: { user: { ...safe, status: 'ONLINE' }, ...tokens },
    };
  }

  // ─── Logout ───────────────────────────────────────────────────────────────────
  async logout(userId: string, refreshToken: string) {
    if (refreshToken) {
      await this.prisma.refreshToken.deleteMany({
        where: { userId, token: refreshToken },
      });
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { status: 'OFFLINE', lastSeen: new Date() },
    });

    this.logger.log(`Logout: ${userId}`);
    return { message: 'Logged out successfully' };
  }

  // ─── Refresh Token ────────────────────────────────────────────────────────────
  async refreshTokens(userId: string, oldTokenId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) throw new UnauthorizedException('User not found or inactive');

    const tokens = await this.generateTokens(user.id, user.email, user.role);

    // Rotate: delete old, insert new
    await this.prisma.$transaction([
      this.prisma.refreshToken.delete({ where: { id: oldTokenId } }),
      this.prisma.refreshToken.create({
        data: {
          token: tokens.refreshToken,
          userId: user.id,
          expiresAt: expiresInMs(SEVEN_DAYS_MS),
        },
      }),
    ]);

    return { message: 'Token refreshed', data: tokens };
  }

  // ─── Forgot Password ──────────────────────────────────────────────────────────
  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });

    // Always return the same message (prevent email enumeration)
    if (!user) return { message: 'If this email exists, a reset link has been sent' };

    const resetToken = generateSecureToken();
    const resetTokenExpiry = expiresInMs(ONE_HOUR_MS);

    await this.prisma.user.update({
      where: { email },
      data: { resetToken, resetTokenExpiry },
    });

    this.emailQueue
      .sendPasswordReset(email, resetToken)
      .catch((e) => this.logger.error('Reset email failed', e));

    this.logger.log(`Password reset requested: ${email}`);
    return { message: 'If this email exists, a reset link has been sent' };
  }

  // ─── Reset Password ───────────────────────────────────────────────────────────
  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpiry: { gt: new Date() } },
    });

    if (!user) throw new BadRequestException('Invalid or expired reset token');

    const password = await hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: { password, resetToken: null, resetTokenExpiry: null },
    });

    // Revoke all sessions for security
    await this.prisma.refreshToken.deleteMany({ where: { userId: user.id } });

    this.logger.log(`Password reset: ${user.email}`);
    return { message: 'Password reset successful. Please log in with your new password.' };
  }

  // ─── Change Password ──────────────────────────────────────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await comparePassword(dto.oldPassword, user.password);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const same = await comparePassword(dto.newPassword, user.password);
    if (same) throw new BadRequestException('New password cannot be same as current password');

    const password = await hashPassword(dto.newPassword);

    await this.prisma.user.update({ where: { id: userId }, data: { password } });

    // Revoke all other sessions
    await this.prisma.refreshToken.deleteMany({ where: { userId } });

    this.logger.log(`Password changed: ${user.email}`);
    return { message: 'Password changed successfully. Please log in again.' };
  }

  // ─── Verify Email ─────────────────────────────────────────────────────────────
  async verifyEmail(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { emailVerifyToken: token },
    });

    if (!user) throw new BadRequestException('Invalid or expired verification token');
    if (user.isEmailVerified) return { message: 'Email is already verified' };

    await this.prisma.user.update({
      where: { id: user.id },
      data: { isEmailVerified: true, emailVerifyToken: null },
    });

    return { message: 'Email verified successfully' };
  }

  // ─── Get Me ───────────────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: SAFE_USER_SELECT,
    });

    if (!user) throw new NotFoundException('User not found');
    return { message: 'Profile fetched', data: user };
  }

  // ─── Private: Generate Token Pair ─────────────────────────────────────────────
  private async generateTokens(userId: string, email: string, role: string) {
    const payload = { sub: userId, email, role };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_SECRET'),
        expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('REFRESH_TOKEN_SECRET'),
        expiresIn: this.configService.get<string>('REFRESH_TOKEN_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
