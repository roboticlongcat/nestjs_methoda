import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { Request } from './request.model';
import { RequestService } from './request.service';
import { AuthModule } from '../auth/auth.module'; // если используется guard
import { RequestController } from './request.controller';

@Module({
  imports: [
    SequelizeModule.forFeature([Request]), // ← обязательно!
    AuthModule,
  ],
  providers: [RequestService],
  controllers: [RequestController],
  exports: [RequestService],
})
export class RequestModule {}