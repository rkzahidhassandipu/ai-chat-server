import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { Prisma, UserStatus } from '@prisma/client';

export const PUBLIC_USER_SELECT = {
  id: true,
  name: true,
  email: true,
  avatar: true,
  bio: true,
  preferredLanguage: true,
  status: true,
  lastSeen: true,
  isEmailVerified: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export const PRIVATE_USER_SELECT = {
  ...PUBLIC_USER_SELECT,
  role: true,
  isActive: true,
  updatedAt: true,
} satisfies Prisma.UserSelect;

@Injectable()
export class UsersRepository {
  constructor(private prisma: PrismaService) {}

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: PUBLIC_USER_SELECT,
    });
  }

  findPrivateById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: PRIVATE_USER_SELECT,
    });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({
      where: { id },
      data,
      select: PRIVATE_USER_SELECT,
    });
  }

  async searchUsers(
    query: string,
    skip: number,
    take: number,
    excludeIds: string[],
  ) {
    const where: Prisma.UserWhereInput = {
      AND: [
        { id: { notIn: excludeIds } },
        { isActive: true },
        query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { email: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {},
      ],
    };

    return this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        select: PUBLIC_USER_SELECT,
        skip,
        take,
        orderBy: { name: 'asc' },
      }),
      this.prisma.user.count({ where }),
    ]);
  }

  updateStatus(id: string, status: UserStatus) {
    return this.prisma.user.update({
      where: { id },
      data: { status, lastSeen: new Date() },
      select: { id: true, status: true, lastSeen: true },
    });
  }

  findBlockedByIds(userId: string) {
    return this.prisma.blockedUser.findMany({
      where: { blockedId: userId },
      select: { blockerId: true },
    });
  }

  findBlock(blockerId: string, blockedId: string) {
    return this.prisma.blockedUser.findUnique({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
  }

  createBlock(blockerId: string, blockedId: string) {
    return this.prisma.blockedUser.create({ data: { blockerId, blockedId } });
  }

  deleteBlock(blockerId: string, blockedId: string) {
    return this.prisma.blockedUser.delete({
      where: { blockerId_blockedId: { blockerId, blockedId } },
    });
  }

  findBlockedUsers(userId: string) {
    return this.prisma.blockedUser.findMany({
      where: { blockerId: userId },
      include: { blocked: { select: PUBLIC_USER_SELECT } },
    });
  }
}
