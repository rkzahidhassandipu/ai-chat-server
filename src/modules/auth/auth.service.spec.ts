import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { PrismaService } from '@core/database/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { EmailService } from '@integrations/email/email.service';
import {
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';

// ─── Mocks ───────────────────────────────────────────────────────────────────
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  refreshToken: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    delete: jest.fn(),
  },
  $transaction: jest.fn(),
};

const mockJwt = {
  signAsync: jest.fn().mockResolvedValue('mock-token'),
};

const mockConfig = {
  get: jest.fn().mockImplementation((key: string) => {
    const map: Record<string, string> = {
      JWT_SECRET: 'test-secret',
      JWT_EXPIRES_IN: '15m',
      REFRESH_TOKEN_SECRET: 'test-refresh-secret',
      REFRESH_TOKEN_EXPIRES_IN: '7d',
    };
    return map[key] || 'test-value';
  }),
};

const mockEmail = {
  sendEmailVerification: jest.fn().mockResolvedValue(undefined),
  sendWelcome: jest.fn().mockResolvedValue(undefined),
  sendPasswordReset: jest.fn().mockResolvedValue(undefined),
};

const mockUser = {
  id: 'user-cuid-1',
  name: 'Test User',
  email: 'test@example.com',
  password: '$2a$12$hashedpassword',
  role: 'USER',
  status: 'OFFLINE',
  isActive: true,
  isEmailVerified: false,
  preferredLanguage: 'en',
  avatar: null,
  bio: null,
  lastSeen: null,
  resetToken: null,
  resetTokenExpiry: null,
  emailVerifyToken: 'verify-token',
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── Test Suite ───────────────────────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: ConfigService, useValue: mockConfig },
        { provide: EmailService, useValue: mockEmail },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  // ─── register() ─────────────────────────────────────────────────────────────
  describe('register()', () => {
    const dto = {
      name: 'Test User',
      email: 'test@example.com',
      password: 'Test@12345',
    };

    it('should register a new user and return safe user data', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      mockPrisma.user.create.mockResolvedValue(mockUser);

      const result = await service.register(dto);

      expect(result.message).toContain('Registration successful');
      expect(result.data.email).toBe(dto.email);
      expect(result.data).not.toHaveProperty('password');
      expect(mockPrisma.user.create).toHaveBeenCalledTimes(1);
    });

    it('should throw ConflictException if email already exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      await expect(service.register(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── login() ────────────────────────────────────────────────────────────────
  describe('login()', () => {
    const dto = { email: 'test@example.com', password: 'Test@12345' };

    it('should throw UnauthorizedException if user does not exist', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is inactive', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ ...mockUser, isActive: false });
      await expect(service.login(dto)).rejects.toThrow(UnauthorizedException);
    });
  });

  // ─── forgotPassword() ───────────────────────────────────────────────────────
  describe('forgotPassword()', () => {
    it('should return generic message even if email does not exist (prevent enumeration)', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await service.forgotPassword('unknown@test.com');
      expect(result.message).toContain('If this email exists');
    });

    it('should generate reset token and send email if user exists', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await service.forgotPassword(mockUser.email);

      expect(mockPrisma.user.update).toHaveBeenCalledTimes(1);
      expect(result.message).toContain('If this email exists');
    });
  });

  // ─── resetPassword() ────────────────────────────────────────────────────────
  describe('resetPassword()', () => {
    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(
        service.resetPassword('bad-token', 'NewPass@123'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── verifyEmail() ──────────────────────────────────────────────────────────
  describe('verifyEmail()', () => {
    it('should throw BadRequestException for invalid token', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);
      await expect(service.verifyEmail('bad-token')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return already-verified message if already verified', async () => {
      mockPrisma.user.findFirst.mockResolvedValue({
        ...mockUser,
        isEmailVerified: true,
      });
      const result = await service.verifyEmail('some-token');
      expect(result.message).toContain('already verified');
    });
  });
});
