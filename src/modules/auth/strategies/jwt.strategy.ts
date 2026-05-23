import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@core/database/prisma.service';
import { JwtPayload } from '@common/interfaces/jwt-payload.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        name: true,
        email: true,
        avatar: true,
        bio: true,
        role: true,
        status: true,
        isActive: true,
        isEmailVerified: true,
        preferredLanguage: true,
        lastSeen: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) throw new UnauthorizedException('User no longer exists');
    if (!user.isActive) throw new UnauthorizedException('Account has been deactivated');

    return user;
  }
}
