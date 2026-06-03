import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { envs } from './config/envs';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: [envs.frontendUrl, 'http://localhost:4200'],
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('ferri-bot')
    .setDescription('Multi-tenant WhatsApp messaging & AI service')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT',
    )
    .addTag('sessions', 'WhatsApp session management')
    .addTag('messages', 'Send messages (text, image, audio, video, doc, bulk)')
    .addTag('webhooks', 'Webhook subscriptions')
    .addTag('ai', 'AI provider configuration & auto-reply')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(envs.port);
  console.log(`ferri-bot running on port ${envs.port}`);
  console.log(`Swagger docs → http://localhost:${envs.port}/docs`);
}

bootstrap();
