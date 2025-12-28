import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { SessionModule } from '../session/session.module'; // для Redis-сессий
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SessionGuard } from './guards/session.guard';

@Module({
  imports: [
    UserModule,
    SessionModule, 
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionGuard,
  ],
  exports: [
    AuthService,
    SessionGuard, 
  ],
})
export class AuthModule {}