import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from '../auth.service';

@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private authService: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    const sessionId = request.cookies?.sessionId;

    if (!sessionId) {
      throw new UnauthorizedException('No session cookie');
    }

    // Получаем userId из Redis по sessionId
    const userId = await this.authService.getUserIdBySessionId(sessionId);
    if (!userId) {
      throw new UnauthorizedException('Invalid or expired session');
    }

    // 🔑 КЛЮЧЕВОЙ МОМЕНТ: добавляем userId в запрос
    (request as any).session = { userId };

    return true;
  }
}