import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  WsException,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  Logger,
  UsePipes,
  PipeTransform,
  Injectable,
  ArgumentMetadata,
} from '@nestjs/common';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChatService } from './chat.service';
import { CHAT_EVENTS, CHAT_EMIT, SocketUser } from './types/chat.types';
import {
  SendMessageDto,
  EditMessageDto,
  TypingDto,
  MarkReadDto,
  JoinRoomDto,
} from './dto/chat.dto';

interface AuthenticatedSocket extends Socket {
  data: { user: SocketUser };
}

// ==========================================
// 🌟 CUSTOM WEBSOCKET VALIDATION PIPE
// ==========================================
@Injectable()
export class CustomWSValidationPipe implements PipeTransform {
  async transform(value: any, { metatype }: ArgumentMetadata) {
    if (!value || !metatype || this.isSocket(value) || !this.toValidate(metatype)) {
      return value;
    }

    let rawData = value;

    if (typeof rawData === 'string') {
      try {
        rawData = JSON.parse(rawData);
      } catch (e) {
        throw new WsException({ status: 'error', message: 'Invalid JSON payload' });
      }
    }

    const object = plainToInstance(metatype, rawData);
    const errors = await validate(object);

    if (errors.length > 0) {
      const formattedErrors = errors.map((err) => ({
        property: err.property,
        errors: Object.values(err.constraints || {}),
      }));

      throw new WsException({
        status: 'validation_error',
        message: 'Validation failed',
        errors: formattedErrors,
      });
    }

    return object;
  }

  private toValidate(metatype: Function): boolean {
    const types: Function[] = [String, Boolean, Number, Array, Object];
    return !types.includes(metatype);
  }

  private isSocket(value: any): boolean {
    return value && value.nsp && value.client && value.conn;
  }
}

// ==========================================
// 💬 CHAT GATEWAY IMPLEMENTATION
// ==========================================
@WebSocketGateway({ transports: ['websocket', 'polling'] })
export class ChatGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(private readonly chatService: ChatService) {}

  afterInit() {
    this.logger.log('💬 Chat Gateway initialized');
  }

  async handleConnection(client: AuthenticatedSocket) {
    const user = client.data?.user;
    if (!user) {
      client.disconnect();
      return;
    }

    if (!this.userSockets.has(user.id)) {
      this.userSockets.set(user.id, new Set());
    }
    this.userSockets.get(user.id)!.add(client.id);
    await client.join(`user:${user.id}`);

    const partnerIds = await this.chatService.setUserOnline(user.id);
    partnerIds.forEach((partnerId) => {
      this.server.to(`user:${partnerId}`).emit(CHAT_EMIT.USER_ONLINE, {
        userId: user.id,
        name: user.name,
        avatar: user.avatar,
      });
    });
  }

  async handleDisconnect(client: AuthenticatedSocket) {
    const user = client.data?.user;
    if (!user) return;

    const sockets = this.userSockets.get(user.id);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(user.id);
        const partnerIds = await this.chatService.setUserOffline(user.id);
        partnerIds.forEach((partnerId) => {
          this.server.to(`user:${partnerId}`).emit(CHAT_EMIT.USER_OFFLINE, {
            userId: user.id,
            lastSeen: new Date(),
          });
        });
      }
    }
  }

  @UsePipes(new CustomWSValidationPipe())
  @SubscribeMessage(CHAT_EVENTS.JOIN_CONVERSATION)
  async handleJoinConversation(
    @MessageBody() dto: JoinRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    if (!dto?.conversationId) {
      client.emit(CHAT_EMIT.ERROR, { message: 'conversationId is required' });
      return;
    }

    const isMember = await this.chatService.validateMembership(
      dto.conversationId,
      client.data.user.id,
    );

    if (!isMember) {
      client.emit(CHAT_EMIT.ERROR, { message: 'You are not a member of this conversation' });
      return;
    }

    await client.join(`conversation:${dto.conversationId}`);
    client.emit('joined', { conversationId: dto.conversationId });
  }

  @UsePipes(new CustomWSValidationPipe())
  @SubscribeMessage(CHAT_EVENTS.LEAVE_CONVERSATION)
  async handleLeaveConversation(
    @MessageBody() dto: JoinRoomDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    await client.leave(`conversation:${dto.conversationId}`);
    return { event: 'left', data: { conversationId: dto.conversationId } };
  }

  @UsePipes(new CustomWSValidationPipe())
  @SubscribeMessage('send_message') 
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() data: SendMessageDto, 
  ) {
    const userId = client.data.user.id;

    const message = await this.chatService.sendMessage(
      data.conversationId,
      userId,
      data.content,
      data.type,
    );

    this.server.to(`conversation:${data.conversationId}`).emit('new_message', message);

    return message;
  }

  @UsePipes(new CustomWSValidationPipe())
  @SubscribeMessage(CHAT_EVENTS.EDIT_MESSAGE)
  async handleEditMessage(
    @MessageBody() dto: EditMessageDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const message = await this.chatService.editMessage(
        dto.messageId,
        client.data.user.id,
        dto.content,
      );
      this.server
        .to(`conversation:${message.conversationId}`)
        .emit(CHAT_EMIT.MESSAGE_EDITED, message);
      return { event: 'message_edited', data: message };
    } catch (error) {
      client.emit(CHAT_EMIT.ERROR, { message: error.message });
    }
  }

  @SubscribeMessage(CHAT_EVENTS.DELETE_MESSAGE)
  async handleDeleteMessage(
    @MessageBody() body: any,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const dto = this.parseBody(body);
      const message = await this.chatService.deleteMessage(dto.messageId, client.data.user.id);
      this.server.to(`conversation:${message.conversationId}`).emit(CHAT_EMIT.MESSAGE_DELETED, {
        messageId: dto.messageId,
        conversationId: message.conversationId,
      });
      client.emit('message_deleted', { messageId: dto.messageId });
    } catch (error) {
      client.emit(CHAT_EMIT.ERROR, { message: error.message });
    }
  }

  @UsePipes(new CustomWSValidationPipe())
  @SubscribeMessage(CHAT_EVENTS.TYPING_START)
  handleTypingStart(@MessageBody() dto: TypingDto, @ConnectedSocket() client: AuthenticatedSocket) {
    client.to(`conversation:${dto.conversationId}`).emit(CHAT_EMIT.USER_TYPING, {
      conversationId: dto.conversationId,
      userId: client.data.user.id,
      userName: client.data.user.name,
    });
  }

  @UsePipes(new CustomWSValidationPipe())
  @SubscribeMessage(CHAT_EVENTS.TYPING_STOP)
  handleTypingStop(@MessageBody() dto: TypingDto, @ConnectedSocket() client: AuthenticatedSocket) {
    client.to(`conversation:${dto.conversationId}`).emit(CHAT_EMIT.USER_STOP_TYPING, {
      conversationId: dto.conversationId,
      userId: client.data.user.id,
    });
  }

  @UsePipes(new CustomWSValidationPipe())
  @SubscribeMessage(CHAT_EVENTS.MARK_READ)
  async handleMarkRead(
    @MessageBody() dto: MarkReadDto,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      await this.chatService.markRead(dto.conversationId, client.data.user.id, dto.messageId);
      this.server.to(`conversation:${dto.conversationId}`).emit(CHAT_EMIT.MESSAGE_READ, {
        conversationId: dto.conversationId,
        messageId: dto.messageId,
        userId: client.data.user.id,
        readAt: new Date(),
      });
    } catch (error) {
      client.emit(CHAT_EMIT.ERROR, { message: error.message });
    }
  }

  // ==========================================
  // 🌟 TRANSLATE MESSAGE IMPLEMENTATION (UPDATED)
  // ==========================================
  @UsePipes(new CustomWSValidationPipe())
  @SubscribeMessage(CHAT_EVENTS.TRANSLATE_MESSAGE)
  async handleTranslateMessage(
    @MessageBody() dto: any,
    @ConnectedSocket() client: AuthenticatedSocket,
  ) {
    try {
      const data = typeof dto === 'string' ? JSON.parse(dto) : dto;

      if (!data?.messageId || !data?.targetLanguage) {
        this.logger.error(`[Translate] Missing fields. MessageId: ${data?.messageId}, Lang: ${data?.targetLanguage}`);
        client.emit(CHAT_EMIT.ERROR, { message: 'messageId and targetLanguage are required' });
        return;
      }

      const translatedData = await this.chatService.translateMessage(
        data.messageId,
        data.targetLanguage,
        client.data.user.id,
      );

      client.emit('message_translated', {
        messageId: data.messageId,
        targetLanguage: data.targetLanguage,
        translatedContent: translatedData.translatedContent,
      });

      this.logger.log(`[Translate] Successfully translated message ${data.messageId} to ${data.targetLanguage}`);
    } catch (error) {
      this.logger.error(`[Translate] Error: ${error.message}`);
      client.emit(CHAT_EMIT.ERROR, { message: error.message });
    }
  }

  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  isUserOnline(userId: string): boolean {
    return this.userSockets.has(userId) && this.userSockets.get(userId)!.size > 0;
  }

  private parseBody(body: any): any {
    const raw = Array.isArray(body) ? body[0] : body;
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  }
}