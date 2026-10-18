import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { VersioningType } from '@nestjs/common';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';

// Origens permitidas no CORS. Para liberar outro domínio sem mexer no código,
// defina CORS_ORIGINS no Render (separado por vírgula).
function getCorsOrigins(): string[] {
  const fromEnv = (process.env.CORS_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (fromEnv.length > 0) return fromEnv;

  const origins = ['https://sowestudio.com.br', 'https://www.sowestudio.com.br'];

  if (process.env.NODE_ENV !== 'production') {
    origins.push('http://localhost:5173');
  }

  return origins;
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableVersioning({
    type: VersioningType.URI,
  });

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
    origin: getCorsOrigins(),
    credentials: true,
  });

  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
