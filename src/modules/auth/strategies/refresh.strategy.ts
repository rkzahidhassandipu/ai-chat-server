import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { PrismaService } from '@core/database/prisma.service';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

@Injectable()
export class RefreshStrategy extends PassportStrategy(Strategy, 'jwt-refresh') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req: Request) => req?.cookies?.refresh_token ?? null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('REFRESH_TOKEN_SECRET'),
      passReqToCallback: true,
    });
  }

  async validate(req: Request, payload: JwtPayload) {
    const token =
      req?.cookies?.refresh_token ||
      req?.headers?.authorization?.replace('Bearer ', '');

    if (!token) throw new UnauthorizedException('Refresh token not provided');

    const stored = await this.prisma.refreshToken.findFirst({
      where: { token, userId: payload.sub },
    });

    if (!stored) throw new UnauthorizedException('Refresh token has been revoked');

    if (stored.expiresAt < new Date()) {
      await this.prisma.refreshToken.delete({ where: { id: stored.id } });
      throw new UnauthorizedException('Refresh token has expired');
    }

    return { id: payload.sub, email: payload.email, tokenId: stored.id };
  }
}
