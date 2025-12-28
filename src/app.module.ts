import { Module } from '@nestjs/common';
import { SequelizeModule } from '@nestjs/sequelize';
import { AppController } from './app.controller';
import { User } from './user/user.model';
import { Request } from './request/request.model';
import { UserModule } from './user/user.module';
import { AuthModule } from './auth/auth.module';
import { RequestModule } from './request/request.module';
import { SessionModule } from './session/session.module';

@Module({
  imports: [
    SequelizeModule.forRoot({
      dialect: 'postgres',
      port: 5435,
      username: 'lab',
      password: 'lab',
      database: 'lab',
      models: [User, Request],
      autoLoadModels: true,
      synchronize: true, // только для dev!
    }),
    UserModule,
    AuthModule,
    RequestModule,
    SessionModule,
  ],
  controllers: [AppController],
})
export class AppModule {}