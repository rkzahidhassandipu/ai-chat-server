import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
  Logger,
  Inject,
} from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { UsersRepository } from './users.repository';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CloudinaryService } from '@integrations/storage/cloudinary.service';
import { Cache } from 'cache-manager';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly usersRepo: UsersRepository,
    @Inject(CACHE_MANAGER) private cache: Cache,
    private cloudinary: CloudinaryService

  ) {}

  // ─── Get My Profile ───────────────────────────────────────────────────────────
  async getMe(userId: string) {
    const user = await this.usersRepo.findPrivateById(userId);
    if (!user) throw new NotFoundException('User not found');
    return { message: 'Profile fetched', data: user };
  }

  // ─── Update Profile ───────────────────────────────────────────────────────────
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const existing = await this.usersRepo.findPrivateById(userId);
    if (!existing) throw new NotFoundException('User not found');

    const updated = await this.usersRepo.update(userId, {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.avatar !== undefined && { avatar: dto.avatar }),
      ...(dto.bio !== undefined && { bio: dto.bio }),
      ...(dto.preferredLanguage !== undefined && { preferredLanguage: dto.preferredLanguage }),
    });

    this.logger.log(`Profile updated: ${userId}`);
    return { message: 'Profile updated successfully', data: updated };
  }

  // ─── Get User By ID ───────────────────────────────────────────────────────────
  async findById(id: string, requesterId: string) {
    const user = await this.usersRepo.findById(id);
    if (!user) throw new NotFoundException('User not found');

    // Check if the user has blocked the requester
    const block = await this.usersRepo.findBlock(id, requesterId);
    if (block) throw new ForbiddenException('You cannot view this profile');

    return { message: 'User fetched', data: user };
  }

  // ─── Search Users ─────────────────────────────────────────────────────────────
  async searchUsers(dto: SearchUsersDto, requesterId: string) {
    const { q = '', page = 1, limit = 10 } = dto;
    const skip = (page - 1) * limit;

    // Exclude users who have blocked the requester
    const blockedBy = await this.usersRepo.findBlockedByIds(requesterId);
    const excludeIds = [requesterId, ...blockedBy.map((b) => b.blockerId)];

    const [users, total] = await this.usersRepo.searchUsers(q, skip, limit, excludeIds);

    return {
      message: 'Users fetched',
      data: {
        users,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1,
        },
      },
    };
  }

  // ─── Update Status ────────────────────────────────────────────────────────────
  async updateStatus(userId: string, status: UserStatus) {
    const updated = await this.usersRepo.updateStatus(userId, status);
    return { message: 'Status updated', data: updated };
  }

  // ─── Block User ───────────────────────────────────────────────────────────────
  async blockUser(blockerId: string, blockedId: string) {
    if (blockerId === blockedId) {
      throw new BadRequestException('You cannot block yourself');
    }

    const target = await this.usersRepo.findById(blockedId);
    if (!target) throw new NotFoundException('User not found');

    const existing = await this.usersRepo.findBlock(blockerId, blockedId);
    if (existing) return { message: 'User is already blocked' };

    await this.usersRepo.createBlock(blockerId, blockedId);
    this.logger.log(`Block: ${blockerId} → ${blockedId}`);

    return { message: `${target.name} has been blocked` };
  }

  // ─── Unblock User ─────────────────────────────────────────────────────────────
  async unblockUser(blockerId: string, blockedId: string) {
    const existing = await this.usersRepo.findBlock(blockerId, blockedId);
    if (!existing) throw new BadRequestException('User is not blocked');

    await this.usersRepo.deleteBlock(blockerId, blockedId);
    this.logger.log(`Unblock: ${blockerId} → ${blockedId}`);

    return { message: 'User has been unblocked' };
  }

  // ─── Get Blocked Users ────────────────────────────────────────────────────────
  async getBlockedUsers(userId: string) {
    const blocked = await this.usersRepo.findBlockedUsers(userId);
    return { message: 'Blocked users fetched', data: blocked.map((b) => b.blocked) };
  }

  // ─── Upload Avatar ─────────────────────────────────────────────────────────────
  async uploadAvatar(userId: string, file: Express.Multer.File) {
    if(!file) {
      throw new BadRequestException('No file uploaded');
    }
    const user = await this.usersRepo.findPrivateById(userId);
    if (!user) throw new NotFoundException('User not found');

    if(user.avatar){
      const publicId = this.cloudinary.extractPublicId(user.avatar);
      if(publicId){
        await this.cloudinary.deleteImage(publicId);
      }
    }

    const { url } = await this.cloudinary.uploadImage(file);
    const updated = await this.usersRepo.update(userId, { avatar: url });

    await this.cache.del(`user:${userId}`); // Clear cache to reflect new avatar

    this.logger.log(`Avatar updated: ${userId}`);
    return {message: 'Avatar uploaded successfully', data: { avatar: url }};

  }
}
