import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from './entities/request.entity';
import { RequestController } from './request.controller';
import { RequestService } from './request.service';
import { AuthModule } from 'src/auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from 'src/redis/redis.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Request]), AuthModule, JwtModule.register({ // ← регистрация JwtModule
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1h' },
    }), 
    RedisModule,
    UserModule
  ],
  controllers: [RequestController],
  providers: [RequestService],
})
export class RequestModule {}