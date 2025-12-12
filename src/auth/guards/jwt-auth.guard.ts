import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = auth.split(' ')[1];

    // Проверка в blacklist
    if (await this.redis.exists(`blacklist:${token}`)) {
      throw new UnauthorizedException('Token revoked');
    }

    // Проверка подписи
    try {
      await this.jwt.verifyAsync(token, { secret: 'secret' });
      return true; // ← токен валиден, но мы НЕ сохраняем payload!
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}