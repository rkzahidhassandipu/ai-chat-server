import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ChatService } from './chat.service';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { CreateGroupConversationDto, CreatePrivateConversationDto } from './dto/chat.dto';
import { CloudinaryService } from '@integrations/storage/cloudinary.service';

@UseGuards(JwtAuthGuard)
@Controller('chat')
export class ChatController {
  constructor(
    private readonly chatService: ChatService,
    private readonly cloudinaryService: CloudinaryService, // Injecting the Cloudinary Service
  ) {}

  @Get('conversations')
  getMyConversations(@CurrentUser('id') userId: string) {
    return this.chatService.getUserConversations(userId);
  }

  @Post('conversations/private')
  createPrivate(@Body() dto: CreatePrivateConversationDto, @CurrentUser('id') userId: string) {
    return this.chatService.getOrCreatePrivateConversation(userId, dto.targetUserId);
  }

  @Post('conversations/group')
  createGroup(@Body() dto: CreateGroupConversationDto, @CurrentUser('id') userId: string) {
    return this.chatService.createGroupConversation(userId, dto.name, dto.memberIds);
  }

  @Get('conversations/:conversationId/messages')
  getMessages(
    @Param('conversationId') conversationId: string,
    @CurrentUser('id') userId: string,
    @Query('cursor') cursor?: string,
  ) {
    return this.chatService.getMessages(conversationId, userId, cursor);
  }

  // ==========================================
  // 📁 NEW: CHAT MEDIA UPLOAD ENDPOINT
  // ==========================================
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 300 * 1024 * 1024, // Maximum file size limit: 25 MB
      },
      // Inside your ChatController @Post('upload') interceptor:
      fileFilter: (req, file, cb) => {
        // Enhanced allowed mime types for documents and archives
        const allowedTypes = [
          // Images
          'image/jpeg',
          'image/png',
          'image/webp',
          'image/gif',
          // Videos & Audio
          'video/mp4',
          'video/mpeg',
          'video/quicktime',
          'audio/mpeg',
          'audio/mp3',
          'audio/wav',
          'audio/ogg',
          // Documents
          'application/pdf', // PDF (.pdf)
          'application/msword', // MS Word (.doc)
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // MS Word (.docx)
          'application/vnd.ms-excel', // MS Excel (.xls)
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // MS Excel (.xlsx)
          'text/plain', // Text File (.txt)
          // Zip / Archives
          'application/zip', // Standard Zip (.zip)
          'application/x-zip-compressed', // Windows Zip (.zip)
          'application/x-tar', // Tar Archive (.tar)
          'application/x-7z-compressed', // 7-Zip (.7z)
        ];

        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(
            new BadRequestException(
              'Unsupported file format! Please upload images, videos, audio, documents, or zip files.',
            ),
            false,
          );
        }
      },
    }),
  )
  async uploadChatMedia(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('No file selected!');
    }

    try {
      // Calling the generic upload method from CloudinaryService
      const result = await this.cloudinaryService.uploadChatMedia(file);

      // Determine the WebSocket MessageType mapping based on the file's Mimetype
      let messageType = 'FILE';
      if (file.mimetype.startsWith('image/')) messageType = 'IMAGE';
      if (file.mimetype.startsWith('video/')) messageType = 'VIDEO';
      if (file.mimetype.startsWith('audio/')) messageType = 'AUDIO';

      return {
        success: true,
        url: result.url,
        publicId: result.publicId,
        type: messageType, // Frontend will pass this directly into the WebSocket SEND_MESSAGE payload
      };
    } catch (error) {
      throw new BadRequestException('File upload failed. Please try again.');
    }
  }
}
