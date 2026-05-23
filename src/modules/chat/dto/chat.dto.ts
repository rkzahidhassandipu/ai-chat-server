import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEnum,
  IsArray,
  ArrayMinSize,
  MaxLength,
} from 'class-validator';
import { MessageType } from '@prisma/client';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;

  @IsEnum(MessageType)
  @IsOptional()
  type?: MessageType = MessageType.TEXT;
}

export class CreatePrivateConversationDto {
  @IsString()
  @IsNotEmpty()
  targetUserId: string;
}

export class CreateGroupConversationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  memberIds: string[];
}

export class EditMessageDto {
  @IsString()
  @IsNotEmpty()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(5000)
  content: string;
}

export class TypingDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsOptional()
  isTyping?: boolean;
}

export class MarkReadDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;

  @IsString()
  @IsNotEmpty()
  messageId: string;
}

export class JoinRoomDto {
  @IsString()
  @IsNotEmpty()
  conversationId: string;
}