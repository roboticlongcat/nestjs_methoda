import {
  Controller,
  Get,
  Post,
  Body,
  UseGuards,
  Req,
  Param,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { Request } from '@nestjs/common';
import { RequestService } from './request.service';
import { CreateRequestDto } from './dto/create-request.dto';
import { SessionGuard } from '../auth/guards/session.guard';

@Controller('api/requests')
export class RequestController {
  constructor(private requestService: RequestService) {}

  @Post()
  @UseGuards(SessionGuard)
  async create(@Body() dto: CreateRequestDto, @Req() req: Request & { session: { userId: number } }) {
    // Автор берётся из сессии
    return this.requestService.create(dto, req.session.userId);
  }

  @Get()
  @UseGuards(SessionGuard)
  async findAll(@Req() req: Request & { session: { userId: number } }) {
    return this.requestService.findAllByAuthor(req.session.userId);
  }

  @Get(':id')
  @UseGuards(SessionGuard)
  async findOne(@Param('id') id: string, @Req() req: Request & { session: { userId: number } }) {
    const request = await this.requestService.findById(+id);
    if (!request) {
      throw new NotFoundException('Request not found');
    }
    // Проверка: только свой или модератор (опционально)
    if (request.authorId !== req.session.userId) {
      throw new ForbiddenException('Access denied');
    }
    return request;
  }
}