import { ApiProperty } from '@nestjs/swagger';

export class CreateRequestDto {
  @ApiProperty({ example: 'Заявка на мемчик' })
  title: string;

  @ApiProperty({ example: 'Хочу мемчик', required: false })
  description?: string;
}