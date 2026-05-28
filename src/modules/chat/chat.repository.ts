import { Injectable } from '@nestjs/common';
import { PrismaService } from '@core/database/prisma.service';
import { MessageType } from '@prisma/client';

@Injectable()
export class ChatRepository {
  constructor(private readonly prisma: PrismaService) {}

  // 1. ডাটাবেজ থেকে ইনবক্স বা কনভারসেশন লিস্ট তুলে আনার মেথড
  async getUserConversations(userId: string) {
    return this.prisma.conversation.findMany({
      where: {
        members: { some: { userId } },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true, status: true, lastSeen: true } },
          },
        },
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });
  }

  async findPrivateConversation(userId1: string, userId2: string) {
    return this.prisma.conversation.findFirst({
      where: {
        type: 'PRIVATE',
        AND: [
          { members: { some: { userId: userId1 } } },
          { members: { some: { userId: userId2 } } },
        ],
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true, status: true } },
          },
        },
        messages: { 
          orderBy: { createdAt: 'desc' }, 
          take: 1,
          include: { translations: true }
        },
      },
    });
  }

  async createPrivateConversation(userId1: string, userId2: string) {
    return this.prisma.conversation.create({
      data: {
        type: 'PRIVATE',
        members: { create: [{ userId: userId1 }, { userId: userId2 }] },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true, status: true } },
          },
        },
      },
    });
  }

  async createGroupConversation(name: string, creatorId: string, memberIds: string[]) {
    const allMemberIds = [...new Set([creatorId, ...memberIds])];
    return this.prisma.conversation.create({
      data: {
        type: 'GROUP',
        name,
        members: {
          create: allMemberIds.map((userId) => ({
            userId,
            role: userId === creatorId ? 'ADMIN' : 'MEMBER',
          })),
        },
      },
      include: {
        members: {
          include: {
            user: { select: { id: true, name: true, avatar: true, status: true } },
          },
        },
      },
    });
  }

  async isConversationMember(conversationId: string, userId: string): Promise<boolean> {
    if (!conversationId || !userId) {
      return false; 
    }

    const member = await this.prisma.conversationMember.findUnique({
      where: {
        conversationId_userId: {
          userId: userId,
          conversationId: conversationId,
        },
      },
    });

    return !!member;
  }

  async createMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: MessageType = 'TEXT',
  ) {
    return this.prisma.message.create({
      data: {
        conversationId,
        senderId,
        content,
        type,
      },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
      },
    });
  }

  async getMessages(conversationId: string, cursor?: string, take = 30) {
    return this.prisma.message.findMany({
      where: { conversationId, isDeleted: false },
      include: {
        sender: { select: { id: true, name: true, avatar: true } },
        translations: true,
        readReceipts: {
          include: { user: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: 'desc' },
      take,
      ...(cursor && { skip: 1, cursor: { id: cursor } }),
    });
  }

  async editMessage(messageId: string, senderId: string, content: string) {
    return this.prisma.message.update({
      where: { id: messageId, senderId },
      data: { content, isEdited: true },
      include: { sender: { select: { id: true, name: true, avatar: true } } },
    });
  }

  async deleteMessage(messageId: string, senderId: string) {
    return this.prisma.message.update({
      where: { id: messageId, senderId },
      data: { isDeleted: true, content: 'This message was deleted' },
    });
  }

  async markConversationRead(conversationId: string, userId: string, upToMessageId: string) {
    const upToMessage = await this.prisma.message.findUnique({
      where: { id: upToMessageId },
    });
    if (!upToMessage) return;

    const unreadMessages = await this.prisma.message.findMany({
      where: {
        conversationId,
        senderId: { not: userId },
        createdAt: { lte: upToMessage.createdAt },
        readReceipts: { none: { userId } },
      },
      select: { id: true },
    });

    if (unreadMessages.length === 0) return;

    await this.prisma.messageReadReceipt.createMany({
      data: unreadMessages.map((m) => ({ messageId: m.id, userId })),
      skipDuplicates: true,
    });

    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });

    return unreadMessages;
  }

  async updateUserStatus(userId: string, status: 'ONLINE' | 'OFFLINE' | 'AWAY') {
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        status,
        ...(status === 'OFFLINE' && { lastSeen: new Date() }),
      },
    });
  }

  async getUserConversationPartnerIds(userId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: {
        conversation: { members: { some: { userId } } },
        userId: { not: userId },
      },
      select: { userId: true },
      distinct: ['userId'],
    });
    return members.map((m) => m.userId);
  }

  async getConversationMemberIds(conversationId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  async findMessageById(messageId: string) {
    return this.prisma.message.findUnique({
      where: { id: messageId },
    });
  }

  async getMessagesByConversationId(conversationId: string) {
    return this.prisma.message.findMany({
      where: { conversationId },
      include: {
        sender: {
          select: { id: true, name: true, avatar: true }
        },
        translations: true, 
      },
      orderBy: { createdAt: 'asc' } 
    });
  }

  // യൂസরের পছন্দের ভাষা জানার মেথড
  async getUserPreferredLanguage(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { preferredLanguage: true },
    });
    
    return user?.preferredLanguage || 'en';
  }
}