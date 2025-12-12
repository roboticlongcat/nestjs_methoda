import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from './entities/request.entity';

@Injectable()
export class RequestService {
  constructor(
    @InjectRepository(Request)
    private repo: Repository<Request>,
  ) {}

  create(dto: any) {
    return this.repo.save(dto);
  }

  findAll() {
    return this.repo.find();
  }

  findAllByAuthor(authorId: number) {
    return this.repo.find({ where: { authorId } });
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  remove(id: number) {
    return this.repo.delete(id);
  }

  update(id: number, dto: any) {
    return this.repo.update(id, dto);
  }
}