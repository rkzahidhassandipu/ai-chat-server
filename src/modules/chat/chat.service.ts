import { BadRequestException, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Cache } from 'cache-manager';
import { ChatRepository } from './chat.repository';
import { MessageType } from '@prisma/client';
import { NOTIFICATION_QUEUE, NOTIFICATION_JOBS } from './queues/notification.queue';
import { TranslationService } from './translation.service';
import { MessageWithTranslation } from './types/chat.types';

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
    private readonly translationService: TranslationService,
  ) {}

  async getOrCreatePrivateConversation(userId: string, targetUserId: string) {
    if (userId === targetUserId)
      throw new Error('Cannot create private conversation with yourself');
    const existing = await this.chatRepository.findPrivateConversation(userId, targetUserId);
    if (existing) return existing;
    const conversation = await this.chatRepository.createPrivateConversation(userId, targetUserId);
    await this.cache.del(CACHE_KEYS.conversations(userId));
    await this.cache.del(CACHE_KEYS.conversations(targetUserId));
    return conversation;
  }

  async getUserConversations(currentUserId: string) {
  const conversations = await this.chatRepository.getUserConversations(currentUserId);
  const targetLanguage = await this.chatRepository.getUserPreferredLanguage(currentUserId);

  // আমরা জানি এটা একটা অ্যারে রিটার্ন করবে
  return await Promise.all(
    conversations.map(async (conv) => {
      if (!conv.messages || conv.messages.length === 0) return conv;

      const lastMessage = conv.messages[0];
      
      if (lastMessage.type === 'TEXT' && lastMessage.senderId !== currentUserId) {
        try {
          const translatedContent = await this.translationService.translateText(
            lastMessage.content,
            targetLanguage,
          );

          console.log("Original:", lastMessage.content);
console.log("Translated Output:", translatedContent);
          
          const hasChanged = translatedContent?.trim().toLowerCase() !== lastMessage.content?.trim().toLowerCase();

          // এখানে আমরা একটি নতুন কনভারসেশন অবজেক্ট রিটার্ন করছি, মেসেজ অবজেক্টটি নয়
          return {
            ...conv,
            messages: [
              {
                ...lastMessage,
                content: translatedContent || lastMessage.content,
                isTranslated: hasChanged,
              } as MessageWithTranslation, // এখানে টাইপ কাস্ট করছি
              ...conv.messages.slice(1),
            ],
          };
        } catch (error) {
          return conv;
        }
      }
      
      return conv;
    }),
  );
}

  async sendMessage(
    conversationId: string,
    senderId: string,
    content: string,
    type: MessageType = 'TEXT',
  ) {
    const isMember = await this.chatRepository.isConversationMember(conversationId, senderId);
    if (!isMember) throw new ForbiddenException('You are not a member of this conversation');

    const message = await this.chatRepository.createMessage(
      conversationId,
      senderId,
      content,
      type
    );

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

  /**
   * 🌟 COMBINED & OPTIMIZED MESSAGES METHOD
   * এটি একাধারে ক্যাশিং হ্যান্ডেল করবে এবং অন-দ্য-ফ্লাই অনুবাদও নিশ্চিত করবে।
   */
  async getMessages(conversationId: string, userId: string, cursor?: string) {
    const isMember = await this.chatRepository.isConversationMember(conversationId, userId);
    if (!isMember) throw new ForbiddenException('You are not a member of this conversation');

    let originalMessages: any[];

    // ১. ক্যাশ মেকানিজম হ্যান্ডেল করা (শুধুমাত্র কার্সর ছাড়া প্রথম রিকোয়েস্টের জন্য)
    if (!cursor) {
      const cacheKey = CACHE_KEYS.messages(conversationId);
      const cached = await this.cache.get<any[]>(cacheKey);
      
      if (cached) {
        originalMessages = cached;
      } else {
        const messages = await this.chatRepository.getMessages(conversationId); 
        originalMessages = messages.reverse();
        await this.cache.set(cacheKey, originalMessages, CACHE_TTL.messages);
      }
    } else {
      const messages = await this.chatRepository.getMessages(conversationId, cursor);
      originalMessages = messages.reverse();
    }

    // ২. ইউজারের ভাষা প্রেফারেন্স তুলে আনা
    const targetLanguage = await this.chatRepository.getUserPreferredLanguage(userId);
    
    // ৩. রিয়েল-টাইমে লুপ চালিয়ে মেসেজগুলো অন-দ্য-ফ্লাই অনুবাদ করা (ক্যাশ করা ডাটার ওপর)
    const translatedMessages = await Promise.all(
  originalMessages.map(async (msg) => {
    if (msg.type === 'TEXT' && msg.senderId !== userId) {
      try {
        const translatedContent = await this.translationService.translateText(msg.content, targetLanguage);
        return {
          ...msg,
          content: translatedContent,
          isTranslated: true, // 👈 এখানেও টাইপস্ক্রিপ্ট আটকাচ্ছিল
        } as any; // 🌟 শেষে 'as any' যোগ করে দিন
      } catch (error) {
        console.error(`Failed to translate message ${msg.id} on the fly:`, error);
        return msg;
      }
    }
    return msg;
  })
);

    return translatedMessages;
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
  if (filtered.length < 2)
    throw new BadRequestException('Group must have at least 2 other members');
  
  const conversation = await this.chatRepository.createGroupConversation(name, userId, filtered);
  
  // 🌟 এখানে ব্র্যাকেট ফিক্স করা হয়েছে: [...filtered, userId]
  await Promise.all(
    [...filtered, userId].map((id) => this.cache.del(CACHE_KEYS.conversations(id))),
  );
  
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

  async translateMessage(messageId: string, targetLanguage: string, userId: string) {
    const message = await this.chatRepository.findMessageById(messageId);
    if (!message) {
      throw new BadRequestException('Message not found');
    }

    const isMember = await this.chatRepository.isConversationMember(message.conversationId, userId);
    if (!isMember) {
      throw new ForbiddenException('You are not authorized to view this message');
    }

    if (message.type !== 'TEXT') {
      throw new BadRequestException('Only text messages can be translated');
    }

    try {
      const translatedText = await this.translationService.translateText(
        message.content,
        targetLanguage,
      );

      return {
        messageId: message.id,
        originalContent: message.content,
        translatedContent: translatedText,
        language: targetLanguage,
      };
    } catch (error) {
      throw new BadRequestException(`Translation pipeline failed: ${error.message}`);
    }
  }
}