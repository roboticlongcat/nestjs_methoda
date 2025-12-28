import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Request } from './request.model';

@Injectable()
export class RequestService {
  constructor(
    @InjectModel(Request)
    private requestModel: typeof Request,
  ) {}

  /* Создать заявку */
  async create(createDto: any, authorId: number) {
    return this.requestModel.create({
      ...createDto,
      authorId,
    });
  }

  /* Получить ВСЕ заявки пользователя */
  async findAllByAuthor(authorId: number) {
    return this.requestModel.findAll({ where: { authorId } });
  }

  /* Получить все заявки */
  async findAll() {
    return this.requestModel.findAll();
  }

  /* Найти одну заявку по ID */
  async findById(id: number) {
    return this.requestModel.findByPk(id);
  }

  /* Проверить, принадлежит ли заявка пользователю */
  async isOwner(requestId: number, userId: number): Promise<boolean> {
    const request = await this.requestModel.findByPk(requestId);
    return !!request && request.authorId === userId;
  }
}