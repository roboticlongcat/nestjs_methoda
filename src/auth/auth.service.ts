import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserService } from '../user/user.service';
import { SessionService } from '../session/session.service';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class AuthService {
  constructor(
    private userService: UserService,
    private sessionService: SessionService,
  ) {}

  async register(email: string, password: string, name?: string) {
    const existing = await this.userService.findByEmail(email);
    if (existing) throw new Error('User already exists');
    return this.userService.create({ email, password, name, role: 'user' });
  }

  async login(email: string, password: string) {
    const user = await this.userService.findByEmail(email);
    if (!user || user.password !== password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const sessionId = uuidv4();
    await this.sessionService.create(sessionId, user.id);
    return { sessionId, user: { id: user.id, email: user.email, role: user.role } };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessionService.destroy(sessionId);
  }

  async validateSession(sessionId: string) {
    const userId = await this.sessionService.getUserId(sessionId);
    if (!userId) throw new UnauthorizedException('Invalid or expired session');
    const user = await this.userService.findById(userId);
    if (!user) throw new UnauthorizedException('User not found');
    return user;
  }

  async getUserIdBySessionId(sessionId: string): Promise<number | null> {
  return this.sessionService.getUserId(sessionId); // ← возвращает number | null
}
}