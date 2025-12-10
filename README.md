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
9. [Интеграция с Redis: blacklist для logout](#9-Интеграция-с-Redis-blacklist-для-logout)
10. [Автоматическое заполнение автора заявки](#10-Автоматическое-заполнение-автора-заявки)
11. [Настройка Swagger с securityDefinitions](#11-Настройка-Swagger-с-securityDefinitions)
12. [Тестирование через curl](#12-Тестирование-через-curl)
13. [Заключение и полезные ссылки](#13-Заключение-и-полезные-ссылки)

---

## 1. Чем отличается аутентификация от авторизации?

- **Аутентификация** — подтверждение личности: «Кто ты?».  
  Пример: ввод email и пароля → сервер проверяет их в БД.

- **Авторизация** — проверка прав: «Что ты можешь?».  
  Пример: пользователь с ролью `user` может редактировать только свои заявки, а `moderator` — все.

> 💡 В нашем проекте JWT-токен содержит `email`, `id` и `role` → это позволяет **и аутентифицировать, и авторизовывать** за один шаг.

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
- Сервер проверяет подпись и извлекает данные → получает `user.id` и `role`.

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
npm install @nestjs/typeorm typeorm pg ioredis @nestjs/swagger
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

---

## 7. Реализация сущностей User и Request

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

Запуск миграции через `synchronize: true` — TypeORM сам создаст таблицы при старте.

---

## 8. JWT-аутентификация: сервис, контроллер, guards

### Шаг 1: Установи `@nestjs/jwt`

```bash
npm install @nestjs/jwt
```

### Шаг 2: AuthModule

```bash
nest g module auth
nest g controller auth
nest g service auth
```

### Шаг 3: AuthController

```ts
// auth.controller.ts
import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() dto: { email: string; password: string; name?: string }) {
    return this.authService.register(dto);
  }

  @Post('login')
  login(@Body() dto: { email: string; password: string }) {
    return this.authService.login(dto);
  }
}
```

### Шаг 4: AuthService

```ts
// auth.service.ts
import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../user/entities/user.entity';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private users: Repository<User>,
    private jwt: JwtService,
  ) {}

  async register({ email, password, name }: any) {
    const user = this.users.create({ email, password, name, role: 'user' });
    return this.users.save(user);
  }

  async login({ email, password }: any) {
    const user = await this.users.findOne({ where: { email, password } });
    if (!user) throw new Error('Invalid credentials');

    const payload = { email: user.email, sub: user.id, role: user.role };
    return { access_token: this.jwt.sign(payload, { expiresIn: '1h' }) };
  }
}
```

### Шаг 5: JwtAuthGuard

```ts
// guards/jwt-auth.guard.ts
import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Redis } from 'ioredis';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  private redis = new Redis(); // подключаемся к localhost:6379

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Bearer ')) throw new UnauthorizedException();

    const token = auth.split(' ')[1];
    if (await this.redis.exists(`blacklist:${token}`)) {
      throw new UnauthorizedException('Token revoked');
    }

    try {
      const payload = await this.jwt.verifyAsync(token, { secret: 'secret' });
      req.user = payload;
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }
}
```

---

## 9. Интеграция с Redis: blacklist для logout

Добавим метод logout:

```ts
// auth.controller.ts
@Post('logout')
@UseGuards(JwtAuthGuard)
logout(@Req() req) {
  const token = req.headers.authorization.split(' ')[1];
  const { exp } = req.user;
  const ttl = exp - Math.floor(Date.now() / 1000);
  this.redis.setex(`blacklist:${token}`, ttl, '1');
  return { ok: true };
}
```

> Теперь токен «умрёт» в Redis автоматически через 1 час.

---

## 10. Автоматическое заполнение автора заявки

В `RequestController`:

```ts
@Post()
@UseGuards(JwtAuthGuard)
create(@Body() dto: CreateRequestDto, @Req() req) {
  return this.requestService.create({
    ...dto,
    authorId: req.user.sub, // ← автоматически!
  });
}
```
---

## 11. Настройка Swagger с securityDefinitions

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

Теперь в Swagger UI (http://localhost:3000/api):
- Нажми **Authorize** → введи `Bearer <ваш_токен>`
- Защищённые эндпоинты станут видны

---

## 12. Тестирование через curl

### Регистрация
```bash
curl -X POST http://localhost:3000/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"123","name":"User"}'
```

### Логин
```bash
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@test.com","password":"123"}'
# Получишь: { "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." }
```

### Создание заявки
```bash
TOKEN="ваш_токен_из_шага_выше"

curl -X POST http://localhost:3000/requests \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"title":"Новая заявка"}'
```

### Logout
```bash
curl -X POST http://localhost:3000/auth/logout \
  -H "Authorization: Bearer $TOKEN"
# После этого токен перестанет работать
```

---

## 13. Заключение и полезные ссылки

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
