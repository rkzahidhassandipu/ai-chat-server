import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  UploadedFile,
  UseInterceptors,
  BadRequestException,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { SearchUsersDto } from './dto/search-users.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { UserStatus } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { avatarMulterConfig } from '@common/utils/multer.util';

@Controller('users')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // GET /users/me
  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMe(@CurrentUser('id') userId: string) {
    return this.usersService.getMe(userId);
  }

  // PATCH /users/update-profile
  @Patch('update-profile')
  @HttpCode(HttpStatus.OK)
  updateProfile(@CurrentUser('id') userId: string, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(userId, dto);
  }

  // GET /users?q=...&page=1&limit=10
  @Get()
  @HttpCode(HttpStatus.OK)
  searchUsers(@CurrentUser('id') userId: string, @Query() dto: SearchUsersDto) {
    return this.usersService.searchUsers(dto, userId);
  }

  // GET /users/blocked
  @Get('blocked')
  @HttpCode(HttpStatus.OK)
  getBlockedUsers(@CurrentUser('id') userId: string) {
    return this.usersService.getBlockedUsers(userId);
  }

  // GET /users/:id
  @Get(':id')
  @HttpCode(HttpStatus.OK)
  getUserById(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.usersService.findById(id, userId);
  }

  // POST /users/block/:id
  @Post('block/:id')
  @HttpCode(HttpStatus.OK)
  blockUser(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.usersService.blockUser(userId, targetId);
  }

  // DELETE /users/block/:id
  @Delete('block/:id')
  @HttpCode(HttpStatus.OK)
  unblockUser(@CurrentUser('id') userId: string, @Param('id') targetId: string) {
    return this.usersService.unblockUser(userId, targetId);
  }

  // PATCH /users/status
  @Patch('status')
  @HttpCode(HttpStatus.OK)
  updateStatus(@CurrentUser('id') userId: string, @Body('status') status: UserStatus) {
    return this.usersService.updateStatus(userId, status);
  }

  // Post /users/upload-avatar
  @Post('upload-avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: {
        fileSize: 5 * 1024 * 1024, // Limit avatar size to 5 MB
      },
      fileFilter: (req, file, cb) => {
        // Allow only typical image formats for avatars
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        
        if (allowedTypes.includes(file.mimetype)) {
          cb(null, true);
        } else {
          cb(new BadRequestException('Invalid file format! Please upload a JPEG, PNG, or WebP image.'), false);
        }
      },
    }),
  )
  async uploadAvatar(
    @CurrentUser('id') userId: string, // Automatically gets logged-in user ID from JWT
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.usersService.uploadAvatar(userId, file);
  }
}

