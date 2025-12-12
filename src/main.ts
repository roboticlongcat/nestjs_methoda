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
      description: 'Enter JWT token with "Bearer " prefix, e.g. "Bearer abc123"',
    })
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  await app.listen(3000);
}
bootstrap();