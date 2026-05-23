import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let errors: any = null;

    // ─── NestJS HTTP Exception ─────────────────────────────────────────────────
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();

      if (typeof res === 'string') {
        message = res;
      } else if (typeof res === 'object') {
        const resObj = res as any;
        // Handle class-validator array messages
        if (Array.isArray(resObj.message)) {
          message = 'Validation failed';
          errors = resObj.message;
        } else {
          message = resObj.message || message;
        }
      }
    }

    // ─── Prisma Known Request Error ────────────────────────────────────────────
    else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      status = HttpStatus.BAD_REQUEST;

      switch (exception.code) {
        case 'P2002': {
          const fields = (exception.meta?.target as string[]) || [];
          message = `${fields.join(', ')} already exists`;
          break;
        }
        case 'P2025':
          status = HttpStatus.NOT_FOUND;
          message = 'Record not found';
          break;
        case 'P2003':
          message = 'Related record not found';
          break;
        case 'P2014':
          message = 'Invalid relation';
          break;
        default:
          message = 'Database error occurred';
      }
    }

    // ─── Prisma Validation Error ───────────────────────────────────────────────
    else if (exception instanceof Prisma.PrismaClientValidationError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Invalid data provided to database';
    }

    // ─── Unknown Error ─────────────────────────────────────────────────────────
    else if (exception instanceof Error) {
      message = exception.message;
      this.logger.error(
        `Unhandled Error: ${exception.message}`,
        exception.stack,
      );
    }

    // Log 5xx errors
    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} → ${status} | ${message}`,
      );
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      errors,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
