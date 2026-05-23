import { Controller, Get } from '@nestjs/common';
import { Public } from '@common/decorators/public.decorator';

@Controller()
export class AppController {
  // ─── GET /health ─────────────────────────────────────────────────────────────
  @Public()

   @Get()
  root() {
    return {
      success: true,
      message: 'AI Chat Backend API Running 🚀',
    };
  }

  @Get('health')
  health() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      version: process.env.npm_package_version || '2.0.0',
    };
  }
}
