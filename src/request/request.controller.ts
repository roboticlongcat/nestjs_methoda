import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RequestService } from './request.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('requests')
export class RequestController {
  constructor(
    private requestService: RequestService,
    private userService: UserService,
    private jwt: JwtService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard) // ← токен валиден и не в blacklist
  async create(@Body() dto: any, @Req() req) {
    // 1. Достаём токен из заголовка
    const auth = req.headers.authorization;
    const token = auth?.split(' ')[1];
    if (!token) throw new UnauthorizedException();

    // 2. Декодируем токен (без проверки — она уже прошла в guard'е)
    const payload = this.jwt.decode(token) as { sub: number };

    // 3. Запрашиваем пользователя из БД 
    const user = await this.userService.findOne(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');

    // 4. Создаём заявку от этого пользователя
    return this.requestService.create({
      ...dto,
      authorId: user.id,
    });
  }
}