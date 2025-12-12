import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register')
  register(@Body() dto: any) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: any) {
    return this.auth.login(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  logout(@Req() req) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) this.auth.logout(token);
    return { ok: true };
  }
}