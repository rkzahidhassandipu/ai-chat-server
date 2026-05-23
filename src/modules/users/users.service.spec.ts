import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import {
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';

const mockRepo = {
  findById: jest.fn(),
  findPrivateById: jest.fn(),
  update: jest.fn(),
  searchUsers: jest.fn(),
  updateStatus: jest.fn(),
  findBlockedByIds: jest.fn(),
  findBlock: jest.fn(),
  createBlock: jest.fn(),
  deleteBlock: jest.fn(),
  findBlockedUsers: jest.fn(),
};

const mockUser = {
  id: 'user-1',
  name: 'Alice',
  email: 'alice@example.com',
  avatar: null,
  bio: null,
  preferredLanguage: 'en',
  status: 'OFFLINE',
  lastSeen: null,
  isEmailVerified: true,
  createdAt: new Date(),
};

describe('UsersService', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: UsersRepository, useValue: mockRepo },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    jest.clearAllMocks();
  });

  // ─── getMe() ──────────────────────────────────────────────────────────────
  describe('getMe()', () => {
    it('should return user profile', async () => {
      mockRepo.findPrivateById.mockResolvedValue(mockUser);
      const result = await service.getMe('user-1');
      expect(result.data).toEqual(mockUser);
    });

    it('should throw NotFoundException if user not found', async () => {
      mockRepo.findPrivateById.mockResolvedValue(null);
      await expect(service.getMe('bad-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── blockUser() ──────────────────────────────────────────────────────────
  describe('blockUser()', () => {
    it('should throw BadRequestException when blocking self', async () => {
      await expect(service.blockUser('user-1', 'user-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFoundException if target user not found', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.blockUser('user-1', 'user-2')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should return already-blocked message if already blocked', async () => {
      mockRepo.findById.mockResolvedValue(mockUser);
      mockRepo.findBlock.mockResolvedValue({ id: 'block-1' });

      const result = await service.blockUser('user-1', 'user-2');
      expect(result.message).toContain('already blocked');
    });

    it('should successfully block a user', async () => {
      mockRepo.findById.mockResolvedValue(mockUser);
      mockRepo.findBlock.mockResolvedValue(null);
      mockRepo.createBlock.mockResolvedValue({});

      const result = await service.blockUser('user-1', 'user-2');
      expect(result.message).toContain('blocked');
      expect(mockRepo.createBlock).toHaveBeenCalledWith('user-1', 'user-2');
    });
  });

  // ─── findById() ───────────────────────────────────────────────────────────
  describe('findById()', () => {
    it('should throw NotFoundException for missing user', async () => {
      mockRepo.findById.mockResolvedValue(null);
      await expect(service.findById('bad-id', 'requester-1')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw ForbiddenException if requester is blocked', async () => {
      mockRepo.findById.mockResolvedValue(mockUser);
      mockRepo.findBlock.mockResolvedValue({ id: 'block-1' });

      await expect(
        service.findById('user-1', 'requester-1'),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
