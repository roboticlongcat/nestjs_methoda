import { ApiProperty } from '@nestjs/swagger';
export class LoginDto {
  @ApiProperty({ example: 'user@test.com' })
  email: string;
  @ApiProperty({ example: '123' })
  password: string;
}