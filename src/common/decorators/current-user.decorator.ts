import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RequestUser } from '../interfaces/jwt-payload.interface';

export const CurrentUser = createParamDecorator(
  (field: keyof RequestUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user: RequestUser = request.user;
    return field ? user?.[field] : user;
  },
);
