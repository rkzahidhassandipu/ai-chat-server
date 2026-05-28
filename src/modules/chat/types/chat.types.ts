import { Message } from "@prisma/client";

export const CHAT_EVENTS = {
  JOIN_CONVERSATION: 'join_conversation',
  LEAVE_CONVERSATION: 'leave_conversation',
  SEND_MESSAGE: 'send_message',
  EDIT_MESSAGE: 'edit_message',
  DELETE_MESSAGE: 'delete_message',
  TYPING_START: 'typing_start',
  TYPING_STOP: 'typing_stop',
  MARK_READ: 'mark_read',
  TRANSLATE_MESSAGE: 'translate_message',
} as const;

export const CHAT_EMIT = {
  NEW_MESSAGE: 'new_message',
  MESSAGE_EDITED: 'message_edited',
  MESSAGE_DELETED: 'message_deleted',
  USER_TYPING: 'user_typing',
  USER_STOP_TYPING: 'user_stop_typing',
  MESSAGE_READ: 'message_read',
  USER_ONLINE: 'user_online',
  USER_OFFLINE: 'user_offline',
  ERROR: 'chat_error',
} as const;

export interface SocketUser {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  role: string;
}

export type MessageType = 'TEXT' | 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE';

export interface ChatMessagePayload {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  type: MessageType;
  createdAt: Date;
}

export type MessageWithTranslation = Message & {
  isTranslated: boolean;
};