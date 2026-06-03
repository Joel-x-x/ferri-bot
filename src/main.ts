import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { envs } from './config/envs';
import { ResponseInterceptor } from './shared/interceptors/response.interceptor';
import { AllExceptionsFilter } from './shared/filters/all-exceptions.filter';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
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

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  const config = new DocumentBuilder()
    .setTitle('ferri-bot')
    .setDescription('Multi-tenant WhatsApp messaging & AI service')
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', in: 'header' },
      'JWT',
    )
    .addTag('health', 'Liveness & readiness probe')
    .addTag('credentials', 'Meta Cloud API credentials per tenant')
    .addTag('meta-webhook', 'Meta webhook verification & incoming events')
    .addTag('messages', 'Send messages (text, image, audio, video, doc, bulk)')
    .addTag('webhooks', 'Webhook subscriptions to tenant systems')
    .addTag('ai', 'AI provider configuration & auto-reply')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });

  await app.listen(envs.port);
  logger.log(`ferri-bot port=${envs.port}`);
  logger.log(`swagger docs=http://localhost:${envs.port}/docs`);
}

bootstrap();
