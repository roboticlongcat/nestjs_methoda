// src/app.controller.ts
import { Controller, Get, Render, Req, Res, UseGuards } from '@nestjs/common';
import type { Request, Response } from 'express';
import { ApiExcludeEndpoint } from '@nestjs/swagger';
import { AuthService } from './auth/auth.service'; // ← импортируем сервис

@Controller()
export class AppController {
  // 🔑 Внедряем AuthService через конструктор
  constructor(private authService: AuthService) {}

  @Get('/login')
  @ApiExcludeEndpoint()
  @Render('login')
  getLogin(@Req() req: Request) {
    return { message: 'Please log in' };
  }

  @Get('/profile')
  @ApiExcludeEndpoint()
  @Render('profile')
  async getProfile(@Req() req: Request, @Res() res: Response) {
    const sessionId = req.cookies?.sessionId;
    if (!sessionId) {
      return res.redirect('/login');
    }

    try {
      const user = await this.authService.validateSession(sessionId);
      if (!user) {
        return res.redirect('/login');
      }

      return res.render('profile', {
        title: 'Profile',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      });
    } catch (err) {
      return res.redirect('/login');
    }
  }
}