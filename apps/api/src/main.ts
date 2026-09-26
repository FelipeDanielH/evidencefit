import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      forbidNonWhitelisted: true,
      transform: true,
      whitelist: true,
    }),
  );
  app.enableCors({
    origin: configService.get<string>('WEB_ORIGIN', 'http://localhost:3000'),
  });

  const port = Number(
    configService.get<string>('API_PORT') ?? configService.get<string>('PORT') ?? '3001',
  );
  await app.listen(port, '0.0.0.0');
}

void bootstrap();
