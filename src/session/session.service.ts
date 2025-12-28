import { Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';

@Injectable()
export class SessionService {
  private readonly redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: 'localhost',
      port: 6379,
    });
    this.redis.on('error', (err) => {
      console.error('Redis SessionStore error:', err);
    });
  }

  /**
   * Создаёт сессию в Redis
   * @param sessionId — уникальный ID сессии
   * @param userId — ID пользователя
   * @param ttlSec — время жизни в секундах (по умолчанию 1 час)
   */
  async create(sessionId: string, userId: number, ttlSec: number = 3600): Promise<void> {
    await this.redis.setex(`session:${sessionId}`, ttlSec, String(userId));
  }

  /* Получает ID пользователя по sessionId */
  async getUserId(sessionId: string): Promise<number | null> {
    const userIdStr = await this.redis.get(`session:${sessionId}`);
    return userIdStr ? parseInt(userIdStr, 10) : null;
  }

  /* Удаляет сессию (logout)*/
  async destroy(sessionId: string): Promise<void> {
    await this.redis.del(`session:${sessionId}`);
  }

  /* Проверяет, существует ли сессия */
  async exists(sessionId: string): Promise<boolean> {
    const exists = await this.redis.exists(`session:${sessionId}`);
    return exists === 1;
  }
}