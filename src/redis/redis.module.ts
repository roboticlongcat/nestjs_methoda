import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';

@Global() // ← глобальный, чтобы инжектить везде без импорта
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (): Redis => {
    const client = new Redis({
      host: 'localhost',
      port: 6380,
    });
    client.on('error', (err) => {
      console.error('🔥 Redis connection error:', err.message);
    });

    return client;
  },
    },
  ],
  exports: ['REDIS_CLIENT'],
}
)

export class RedisModule {}