import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // CONFIG SWAGGER
  const config = new DocumentBuilder()
    .setTitle('Sowe API')
    .setDescription('API oficial do sistema Sowe')
    .setVersion('1.0')
    .addBearerAuth() // IMPORTANTE
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document);

  app.enableCors({
    origin: 'https://sowestudio.com.br/',
    credentials: true,
  });

  await app.listen(process.env.PORT || 3000);
}
bootstrap();
