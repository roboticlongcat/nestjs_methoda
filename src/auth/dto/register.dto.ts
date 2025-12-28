import { ApiProperty } from '@nestjs/swagger';

export class RegisterDto {
  @ApiProperty({ example: 'user@test.com' })
  email: string;

  @ApiProperty({ example: '123' })
  password: string;

  @ApiProperty({ example: 'Test User', required: false })
  name?: string;
}