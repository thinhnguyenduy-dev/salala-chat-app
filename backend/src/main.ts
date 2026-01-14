import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import { LoggingInterceptor } from './logger/logging.interceptor';
import { CustomLoggerService } from './logger/logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  // Use Winston logger
  const logger = app.get(WINSTON_MODULE_NEST_PROVIDER);
  app.useLogger(logger);

  // Get custom logger for startup messages
  const customLogger = app.get(CustomLoggerService);
  customLogger.setContext('Bootstrap');

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );

  // Add global logging interceptor
  app.useGlobalInterceptors(new LoggingInterceptor(customLogger));

  app.enableCors({
    origin: ['http://localhost:3000'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);

  customLogger.log(`Application is running on: http://localhost:${port}`);
  customLogger.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  customLogger.log(`Log level: ${process.env.LOG_LEVEL || 'info'}`);
}

bootstrap().catch((error) => {
  console.error('Failed to start application:', error);
  process.exit(1);
});

