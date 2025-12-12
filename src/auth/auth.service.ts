import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';
import { UserService } from '../user/user.service';

@Injectable()
export class AuthService {
  constructor(
    private users: UserService,
    private jwt: JwtService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async register({ email, password, name }: any) {
    const user = await this.users.findByEmail(email);
    if (user) throw new Error('User already exists');
    return this.users.create({ email, password, name, role: 'user' });
  }

  async login({ email, password }: any) {
    const user = await this.users.findByEmail(email);
    if (!user || user.password !== password) throw new Error('Invalid credentials');
    const payload = { email: user.email, sub: user.id, role: user.role };
    return { access_token: this.jwt.sign(payload, { expiresIn: '1h' }) };
  }

  async logout(token: string) {
    try {
      const { exp } = this.jwt.decode(token) as any;
      const ttl = exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await this.redis.setex(`blacklist:${token}`, ttl, '1');
      }
    } catch (e) {
      // ignore invalid tokens
    }
  }

  async isTokenBlacklisted(token: string): Promise<boolean> {
    const exists = await this.redis.exists(`blacklist:${token}`);
    return exists === 1;
  }
}