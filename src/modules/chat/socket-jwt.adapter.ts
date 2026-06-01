import { IoAdapter } from '@nestjs/platform-socket.io';
import { ServerOptions } from 'socket.io';
import { INestApplicationContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@core/database/prisma.service';

export class SocketIoJwtAdapter extends IoAdapter {
  private jwtService: JwtService;
  private configService: ConfigService;
  private prismaService: PrismaService;

  constructor(private app: INestApplicationContext) {
    super(app);
    this.jwtService = app.get(JwtService);
    this.configService = app.get(ConfigService);
    this.prismaService = app.get(PrismaService);
  }

  createIOServer(port: number, options?: ServerOptions) {
    const clientUrl = this.configService.get<string>(
      'CLIENT_URL',
      'https://ai-chat-client-ew1l.onrender.com',
    );

    const server = super.createIOServer(port, {
      ...options,
      cors: {
        origin: clientUrl,
        credentials: true,
        methods: ['GET', 'POST'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['Set-Cookie'],
      },
    });

    server.use(async (socket: any, next: any) => {
      try {
        const accessToken = this.extractToken(socket);

        if (!accessToken) {
          return next(new Error('No token provided'));
        }

        const jwtSecret = this.configService.get('JWT_SECRET');
        const payload = this.jwtService.verify(accessToken, { secret: jwtSecret });

        const user = await this.prismaService.user.findUnique({
          where: { id: payload.sub },
          select: {
            id: true,
            name: true,
            email: true,
            avatar: true,
            role: true,
            isActive: true,
          },
        });

        if (!user || !user.isActive) {
          return next(new Error('User not found or inactive'));
        }

        socket.data.user = user;
        next();
      } catch (e: any) {
        next(new Error('Invalid token: ' + e.message));
      }
    });

    return server;
  }

  private extractToken(socket: any): string | null {
    // 1. Query param: ?token=xxx  
    if (socket.handshake.query?.token) {
      return socket.handshake.query.token;
    }

    // 2. Auth object: { token: 'xxx' }
    if (socket.handshake.auth?.token) {
      return socket.handshake.auth.token;
    }

    // 3. Authorization header: Bearer xxx
    const authHeader = socket.handshake.headers?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    // 4. Cookie
    const cookieHeader = socket.handshake.headers?.cookie || '';
    if (cookieHeader) {
      const cookies: Record<string, string> = {};
      cookieHeader.split(';').forEach((c: string) => {
        const [k, ...v] = c.trim().split('=');
        if (k) cookies[k.trim()] = v.join('=');
      });
      return cookies['access_token'] || cookies['accessToken'] || null;
    }

    return null;
  }
}