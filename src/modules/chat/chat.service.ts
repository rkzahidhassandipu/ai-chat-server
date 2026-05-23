import { BadRequestException, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ChatRepository } from './chat.repository';
import { MessageType } from '@prisma/client';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from './queues/notification.queue';

const CACHE_KEYS = {
  conversations: (userId: string) => `conversations:${userId}`,
  messages: (conversationId: string) => `messages:${conversationId}`,
};

const CACHE_TTL = {
  conversations: 60_000,
  messages: 30_000,
};

@Injectable()
export class ChatService {
  constructor(
    private readonly chatRepository: ChatRepository,
    @Inject(CACHE_MANAGER) private readonly cache: Cache,
    @InjectQueue(NOTIFICATION_QUEUE) private readonly notificationQueue: Queue,
  ) {}

  async getOrCreatePrivateConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId) throw new Error('Cannot create private conversation with yourself');
    const existing = await this.chatRepository.findPrivateConversation(userId, targetUserId);
    if (existing) return existing;
    const conversation = await this.chatRepository.createPrivateConversation(userId, targetUserId);
    await this.cache.del(CACHE_KEYS.conversations(userId));
    await this.cache.del(CACHE_KEYS.conversations(targetUserId));
    return conversation;
  }

  async getUserConversations(userId: string) {
    const cacheKey = CACHE_KEYS.conversations(userId);
    const cached = await this.cache.get(cacheKey);
    if (cached) return cached;
    const conversations = await this.chatRepository.getUserConversations(userId);
    await this.cache.set(cacheKey, conversations, CACHE_TTL.conversations);
    return conversations;
  }

  async sendMessage(conversationId: string, senderId: string, content: string, type: MessageType = 'TEXT') {
    const isMember = await this.chatRepository.isConversationMember(conversationId, senderId);
    if (!isMember) throw new ForbiddenException('You are not a member of this conversation');

    const message = await this.chatRepository.createMessage(conversationId, senderId, content, type);

    await this.cache.del(CACHE_KEYS.messages(conversationId));

    const memberIds = await this.chatRepository.getConversationMemberIds(conversationId);
    await Promise.all(
      memberIds
        .filter((id) => id !== senderId)
        .map(async (receiverId) => {
          await this.cache.del(CACHE_KEYS.conversations(receiverId));
          await this.notificationQueue.add(NOTIFICATION_JOBS.NEW_MESSAGE, {
            senderId,
            receiverId,
            message: content,
            conversationId,
          });
        }),
    );

    return message;
  }

  async getMessages(conversationId: string, userId: string, cursor?: string) {
    const isMember = await this.chatRepository.isConversationMember(conversationId, userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this conversation');

    if (!cursor) {
      const cacheKey = CACHE_KEYS.messages(conversationId);
      const cached = await this.cache.get(cacheKey);
      if (cached) return cached;
      const messages = await this.chatRepository.getMessages(conversationId);
      const reversed = messages.reverse();
      await this.cache.set(cacheKey, reversed, CACHE_TTL.messages);
      return reversed;
    }

    const messages = await this.chatRepository.getMessages(conversationId, cursor);
    return messages.reverse();
  }

  async editMessage(messageId: string, senderId: string, content: string) {
    try {
      const message = await this.chatRepository.editMessage(messageId, senderId, content);
      await this.cache.del(CACHE_KEYS.messages(message.conversationId));
      return message;
    } catch {
      throw new ForbiddenException('Message not found or you are not the sender');
    }
  }

  async deleteMessage(messageId: string, senderId: string) {
    try {
      const message = await this.chatRepository.deleteMessage(messageId, senderId);
      await this.cache.del(CACHE_KEYS.messages(message.conversationId));
      return message;
    } catch {
      throw new ForbiddenException('Message not found or you are not the sender');
    }
  }

  async markRead(conversationId: string, userId: string, messageId: string) {
    const isMember = await this.chatRepository.isConversationMember(conversationId, userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this conversation');
    await this.notificationQueue.add(NOTIFICATION_JOBS.MESSAGE_READ, { userId, conversationId });
    return this.chatRepository.markConversationRead(conversationId, userId, messageId);
  }

  async createGroupConversation(userId: string, name: string, memberIds: string[]) {
    const filtered = memberIds.filter((id) => id !== userId);
    if (filtered.length < 2) throw new BadRequestException('Group must have at least 2 other members');
    const conversation = await this.chatRepository.createGroupConversation(name, userId, filtered);
    await Promise.all([...filtered, userId].map((id) => this.cache.del(CACHE_KEYS.conversations(id))));
    return conversation;
  }

  async setUserOnline(userId: string) {
    await this.chatRepository.updateUserStatus(userId, 'ONLINE');
    await this.cache.del(CACHE_KEYS.conversations(userId));
    return this.chatRepository.getUserConversationPartnerIds(userId);
  }

  async setUserOffline(userId: string) {
    await this.chatRepository.updateUserStatus(userId, 'OFFLINE');
    await this.cache.del(CACHE_KEYS.conversations(userId));
    return this.chatRepository.getUserConversationPartnerIds(userId);
  }

  async validateMembership(conversationId: string, userId: string): Promise<boolean> {
    return this.chatRepository.isConversationMember(conversationId, userId);
  }
}