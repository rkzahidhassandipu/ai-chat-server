import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Req,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtAuthGuard } from '@common/guards/jwt-auth.guard';
import { RefreshTokenGuard } from '@common/guards/refresh-token.guard';
import { CurrentUser } from '@common/decorators/current-user.decorator';
import { Public } from '@common/decorators/public.decorator';

const REFRESH_COOKIE = 'refresh_token';

const cookieOptions = (isProduction: boolean) => ({
  httpOnly: true,
  secure: isProduction,
  sameSite: 'strict' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});

@Controller('auth')
export class AuthController {
  private readonly isProd = process.env.NODE_ENV === 'production';

  constructor(private readonly authService: AuthService) {}

  // POST /auth/register
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  // POST /auth/login
  @Public()
  @Throttle({ default: { limit: 5, ttl: 900000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const result = await this.authService.login(dto);

    res.cookie(REFRESH_COOKIE, result.data.refreshToken, cookieOptions(this.isProd));

    const { refreshToken: _, ...data } = result.data;
    return { ...result, data };
  }

  // POST /auth/logout
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @CurrentUser('id') userId: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const token = req.cookies?.[REFRESH_COOKIE] ?? '';
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
    return this.authService.logout(userId, token);
  }

  // POST /auth/refresh-token
  @Public()
  @UseGuards(RefreshTokenGuard)
  @Post('refresh-token')
  @HttpCode(HttpStatus.OK)
  async refreshToken(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.refreshTokens(user.id, user.tokenId);

    res.cookie(REFRESH_COOKIE, result.data.refreshToken, cookieOptions(this.isProd));

    const { refreshToken: _, ...data } = result.data;
    return { ...result, data };
  }

  // POST /auth/forgot-password
  @Public()
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  // POST /auth/reset-password
  @Public()
  @Throttle({ default: { limit: 5, ttl: 3600000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.token, dto.newPassword);
  }

  // PATCH /auth/change-password
  @UseGuards(JwtAuthGuard)
  @Patch('change-password')
  @HttpCode(HttpStatus.OK)
  changePassword(@CurrentUser('id') userId: string, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(userId, dto);
  }

  // GET /auth/verify-email?token=xxx
  @Public()
  @Get('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Query('token') token: string) {
    return this.authService.verifyEmail(token);
  }

  // GET /auth/me
  @UseGuards(JwtAuthGuard)
  @SkipThrottle()
  @Get('me')
  @HttpCode(HttpStatus.OK)
  getMe(@CurrentUser('id') userId: string) {
    return this.authService.getMe(userId);
  }
}
