# Методические указания по выполнению лабораторной работы №4  
## Аутентификация и авторизация в NestJS с использованием JWT, Redis и ролевой модели

В этой лабораторной работе вы реализуете бэкенд-часть веб-приложения на **NestJS**, которая поддерживает:
- **Регистрацию и аутентификацию через JWT** (JSON Web Token),
- **Ролевую модель**: `user` и `moderator`,
- **Автоматическое привязывание пользователя к его заявкам**,
- **Хранение активных/отозванных токенов в Redis**,
- **Swagger-документацию с разграничением доступа**.


## Содержание

1. [Чем отличается аутентификация от авторизации?](#1-Чем-отличается-аутентификация-от-авторизации)
2. [JWT: теория и принцип работы](#2-JWT-теория-и-принцип-работы)
3. [Зачем нужен Redis при использовании JWT?](#3-Зачем-нужен-Redis-при-использовании-JWT)
4. [Подготовка окружения](#4-Подготовка-окружения)
5. [Создание проекта NestJS](#5-Создание-проекта-NestJS)
6. [Настройка PostgreSQL и TypeORM](#6-Настройка-PostgreSQL-и-TypeORM)
7. [Реализация сущностей User и Request](#7-Реализация-сущностей-user-и-request)
8. [JWT-аутентификация: сервис, контроллер, guards](#8-JWT-аутентификация-сервис-контроллер-guards)
9. [Автоматическое заполнение автора заявки](#9-Автоматическое-заполнение-автора-заявки)
10. [Настройка Swagger с securityDefinitions](#10-Настройка-Swagger-с-securityDefinitions)
11. [Тестирование через Postman](#11-Тестирование-через-Postman)
12. [Заключение и полезные ссылки](#12-Заключение-и-полезные-ссылки)

---

## 1. Чем отличается аутентификация от авторизации?

- **Аутентификация** — подтверждение личности: «Кто ты?».  
  Пример: ввод email и пароля → сервер проверяет их в БД.

- **Авторизация** — проверка прав: «Что ты можешь?».  
  Пример: пользователь с ролью `user` может редактировать только свои заявки, а `moderator` — все.

---

## 2. JWT: теория и принцип работы

**JWT (JSON Web Token)** — это строка вида `header.payload.signature`, где:
- `header` — алгоритм подписи (например, `HS256`);
- `payload` — полезные данные (например, `{ sub: 1, email: "user@example.com", role: "user" }`);
- `signature` — подпись, вычисленная на основе header + payload + секретного ключа.

📌 JWT **не шифрует данные**, а **подписывает** их. Любой может прочитать payload, но **подделать токен без секретного ключа невозможно**.

👉 В нашем случае:
- При `/auth/login` сервер генерирует JWT и отдаёт его клиенту.
- Клиент при каждом запросе шлёт заголовок:  
  `Authorization: Bearer <токен>`
- Сервер проверяет подпись и извлекает данные о пользователе.

---

## 3. Зачем нужен Redis при использовании JWT?

JWT — **stateless**, то есть сервер не хранит информацию о токене.  
Но тогда **как отозвать токен при logout?**

Решение: хранить **отозванные токены в Redis** с TTL = времени жизни JWT.

> Пример:  
> - JWT живёт 1 час.  
> - При logout — записываем токен в Redis с TTL=3600 сек.  
> - При каждом запросе — проверяем: есть ли токен в blacklist?  
> → Если да — **отказываем в доступе**, даже если подпись валидна.

---

## 4. Подготовка окружения

Убедитесь, что установлены:

- **Node.js 18+ LTS**  
  ```bash
  node -v  # ≥ v18.0.0
  npm -v   # ≥ 8.x
  ```

- **Docker** (для PostgreSQL и Redis)  
  ```bash
  docker --version
  ```

- **NestJS CLI** (глобально):  
  ```bash
  npm install -g @nestjs/cli
  ```

- **PostgreSQL и Redis через Docker**:  
  ```bash
  docker run --name postgres-lab -e POSTGRES_USER=lab -e POSTGRES_PASSWORD=lab -e POSTGRES_DB=lab -p 5432:5432 -d postgres:15
  docker run --name redis-jwt -p 6379:6379 -d redis:7-alpine
  ```
---

## 5. Создание проекта NestJS

```bash
nest new auth-lab
# выберите npm как менеджер
cd auth-lab
```

Установим зависимости:

```bash
npm install @nestjs/typeorm typeorm pg ioredis @nestjs/swagger @nestjs/jwt
```
---

## 6. Настройка PostgreSQL и TypeORM

В `app.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'lab',
      password: 'lab',
      database: 'lab',
      entities: [__dirname + '/**/*.entity{.ts,.js}'],
      synchronize: true, 
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
```
Запуск миграции через `synchronize: true` — TypeORM сам создаст таблицы при старте.
---

## 7. Реализация сущностей User и Request 

Реализуем сущности заявки и пользователя, чтобы протестировать работу нашего сервиса с авторизацией.

`src/user/entities/user.entity.ts`:
```ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { Request } from '../../request/entities/request.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ nullable: true })
  name: string;

  @Column({ default: 'user' })
  role: 'user' | 'moderator';

  @OneToMany(() => Request, (request) => request.author)
  requests: Request[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```
`src/request/entities/request.entity.ts`:
```ts
import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('requests')
export class Request {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  title: string;

  @Column({ nullable: true })
  description: string;

  @Column({ default: 'pending' })
  status: 'pending' | 'approved' | 'rejected';

  @Column()
  authorId: number;

  @ManyToOne(() => User, (user) => user.requests)
  @JoinColumn({ name: 'authorId' })
  author: User;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```
Пока напишем сервис для заявок с typeorm:
```ts
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
```

Добавим логику сервиса, чтобы проверять существование пользователя в БД:

`src/user/user.service.ts`:
import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private repo: Repository<User>,
  ) {}

  create(data: Partial<User>) {
    return this.repo.save(data);
  }

  findOne(id: number) {
    return this.repo.findOne({ where: { id } });
  }

  findByEmail(email: string) {
    return this.repo.findOne({ where: { email } });
  }
}

Для возможности экспорта модуля UserService:

`user.module.ts`:
```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserService } from './user.service';
import { User } from './entities/user.entity';

@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
```

---

## 8. JWT-аутентификация: сервис, контроллер, guards

### Шаг 1: Инициирование модуля auth

```bash
nest g module auth
nest g controller auth
nest g service auth
```

### Шаг 2: RedisModule

Добавим модуль, запускающий работу клиента Redis, к которому мы будем обращаться в AuthModule.

```ts
import { Global, Module } from '@nestjs/common';
import { Redis } from 'ioredis';

@Global() // ← глобальный, чтобы инжектить везде без импорта
@Module({
  providers: [
    {
      provide: 'REDIS_CLIENT',
      useFactory: (): Redis => {
    const client = new Redis({ // инициируем подключение
      host: 'localhost',
      port: 6379,
    });
    client.on('error', (err) => {
      console.error('Redis connection error:', err.message);
    });

    return client;
  },
    },
  ],
  exports: ['REDIS_CLIENT'],
}
)

export class RedisModule {}
```

### Шаг 3: JwtAuthGuard

Напишем отдельный guard для проверки подписей ( своего рода защитник нашего веб-сервиса :) )
`src/auth/guards/jwt-auth.guard.ts`:

```ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private jwt: JwtService,
    @Inject('REDIS_CLIENT') private readonly redis: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const auth = req.headers.authorization;

    if (!auth || !auth.startsWith('Bearer ')) {
      throw new UnauthorizedException('Missing or invalid Authorization header');
    }

    const token = auth.split(' ')[1];

    // Проверка в blacklist
    if (await this.redis.exists(`blacklist:${token}`)) {
      throw new UnauthorizedException('Token revoked');
    }

    // Проверка подписи
    try {
      await this.jwt.verifyAsync(token, { secret: 'secret' });
      return true; // ← токен валиден
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}
```

### Шаг 4: AuthModule

`src/auth/auth.service.ts`:

```ts
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
```

Добавим написанный JWTGuard, который будет требовать JWT для каждого метода, требующего авторизации, в контроллер.

```ts
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
```

Организуем все в модуле, чтобы добавить функции с использованием авторизации в модуле Заявок.

```ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { RedisModule } from 'src/redis/redis.module';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    UserModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1h' },
    },
  ),
  RedisModule
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtAuthGuard],
})
export class AuthModule {}
```

---

## 9. Автоматическое заполнение автора заявки в модуле заявок

Создадим в `request.controller.ts` метод создания заявки с использованием авторизации (чтобы автоматически подставлять автора заявки):

```ts
import {
  Controller,
  Post,
  Body,
  Req,
  UseGuards,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserService } from '../user/user.service';
import { RequestService } from './request.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('requests')
export class RequestController {
  constructor(
    private requestService: RequestService,
    private userService: UserService,
    private jwt: JwtService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard) // ← токен валиден и не в blacklist
  async create(@Body() dto: any, @Req() req) {
    // 1. Достаём токен из заголовка
    const auth = req.headers.authorization;
    const token = auth?.split(' ')[1];
    if (!token) throw new UnauthorizedException();

    // 2. Декодируем токен (без проверки — она уже прошла в guard'е)
    const payload = this.jwt.decode(token) as { sub: number };

    // 3. Запрашиваем пользователя из БД 
    const user = await this.userService.findOne(payload.sub);
    if (!user) throw new UnauthorizedException('User not found');

    // 4. Создаём заявку от этого пользователя
    return this.requestService.create({
      ...dto,
      authorId: user.id,
    });
  }
}
```

В модуле укажем все созданные модули:

```ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Request } from './entities/request.entity';
import { RequestController } from './request.controller';
import { RequestService } from './request.service';
import { AuthModule } from 'src/auth/auth.module';
import { JwtModule } from '@nestjs/jwt';
import { RedisModule } from 'src/redis/redis.module';
import { UserModule } from 'src/user/user.module';

@Module({
  imports: [TypeOrmModule.forFeature([Request]), AuthModule, JwtModule.register({ // ← регистрация JwtModule
      secret: process.env.JWT_SECRET || 'secret',
      signOptions: { expiresIn: '1h' },
    }), 
    RedisModule,
    UserModule
  ],
  controllers: [RequestController],
  providers: [RequestService],
})
export class RequestModule {}
```
Не забудьте обновить импорты в `app.module.ts` (RedisModule, AuthModule, UserModule, RequestModule)!
---

## 10. Настройка Swagger с securityDefinitions

В `main.ts`:

```ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const config = new DocumentBuilder()
    .setTitle('JWT Auth Lab')
    .setDescription('API with JWT, Redis, PostgreSQL')
    .setVersion('1.0')
    .addSecurity('Bearer', {
      type: 'apiKey',
      name: 'Authorization',
      in: 'header',
      description: 'Enter JWT token with "Bearer " prefix',
    })
    .build();

  const doc = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, doc);

  await app.listen(3000);
}
bootstrap();
```

Зайдем на `http://localhost:3000/api` и посмотрим, что записалось в сваггере:
<img width="3072" height="1824" alt="изображение" src="https://github.com/user-attachments/assets/2eb42e0a-2055-49b5-bb7d-f58a51283ebd" />

Все наши методы отразились в документации! Как тестировать? 
- Нажми **Authorize** → введи `Bearer <ваш_токен>`
  <img width="3072" height="1824" alt="изображение" src="https://github.com/user-attachments/assets/108ac36a-5f79-401f-8061-b898f04386d6" />
- Готово! Теперь можно тестировать методы, требующие авторизации :)

---

## 11. Тестирование через Postman

### Регистрация - `http://localhost:3000/auth/register`
```json
{
"email":"user@test.com",
"password":"123",
"name":"User"
}
```
<img width="3072" height="1824" alt="изображение" src="https://github.com/user-attachments/assets/8ce527f2-3e29-4f6e-a17f-3d70aa689e24" />


### Логин - `http://localhost:3000/auth/login`
```json
{
"email":"user@test.com",
"password":"123",
}
```
<img width="3072" height="1824" alt="изображение" src="https://github.com/user-attachments/assets/497ff93d-2c50-4e79-9a19-dfec3366acf3" />
Сохраните токен и используйте его в следующих методах (пример заполнения заголовка на скриншоте)
<img width="3072" height="1824" alt="изображение" src="https://github.com/user-attachments/assets/345adf11-ff3e-4ae9-946a-9d1f410a8592" />


### Создание заявки
```json
{
"title": "meow"
}
```
Получим всю информацию о заявке в ответе и заполненного автора:
<img width="3072" height="1824" alt="изображение" src="https://github.com/user-attachments/assets/8a0600a6-651e-4cde-abad-fbc48b23dde9" />


### Выход из аккаунта
Видим, что логаут прошел успешно.
<img width="3072" height="1824" alt="изображение" src="https://github.com/user-attachments/assets/8a5421cc-9137-4a74-b1cd-e992870af576" />
Попробуем сделать что-нибудь по нашему токену и увидим, что токен в блэклисте и теперь мы не можем им воспользоваться.
<img width="3072" height="1824" alt="изображение" src="https://github.com/user-attachments/assets/cddcbd62-77c3-4f37-a2e6-4f926a36fcab" />

---

## 12. Заключение и полезные ссылки

Вы реализовали:
- ✅ JWT-аутентификацию,
- ✅ Хранение пользователей и заявок в PostgreSQL,
- ✅ Отзыв токенов через Redis,
- ✅ Ролевой доступ: `user` vs `moderator`,
- ✅ Автоматическое заполнение `authorId`,
- ✅ Swagger-документацию с безопасностью.

### Полезные ссылки
- [JWT.io](https://jwt.io) — интерактивный декодер JWT
- [RFC 7519 — спецификация JWT](https://datatracker.ietf.org/doc/html/rfc7519)
- [NestJS Docs — Authentication](https://docs.nestjs.com/security/authentication)
- [Swagger 2.0 Spec](https://swagger.io/specification/v2/)

> 🎉 Поздравляем! Теперь вы умеете строить безопасные API с JWT и Redis!
