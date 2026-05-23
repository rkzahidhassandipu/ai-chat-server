import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '../interfaces/api-response.interface';

@Injectable()
export class ResponseInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const response = ctx.getResponse();

    return next.handle().pipe(
      map((data) => {
        // Already formatted — pass through
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        return {
          success: true,
          statusCode: response.statusCode,
          message: data?.message || 'Success',
          data: data?.data !== undefined ? data.data : data,
          timestamp: new Date().toISOString(),
        };
      }),
    );
  }
}
