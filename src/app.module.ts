import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { UserModule } from './user/user.module';
import { RequestModule } from './request/request.module';
import { RedisModule } from './redis/redis.module';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'lab',
      password: 'lab',
      database: 'lab',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, // only for dev!
    }),
    RedisModule,
    AuthModule,
    UserModule,
    RequestModule,
  ],
})
export class AppModule {}