import { Injectable, LoggerService, Inject } from '@nestjs/common';
import { Logger } from 'winston';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';

@Injectable()
export class CustomLoggerService implements LoggerService {
  private context?: string;

  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  setContext(context: string) {
    this.context = context;
  }

  log(message: any, context?: string) {
    this.logger.info(message, { context: context || this.context });
  }

  error(message: any, trace?: string, context?: string) {
    this.logger.error(message, {
      context: context || this.context,
      trace,
    });
  }

  warn(message: any, context?: string) {
    this.logger.warn(message, { context: context || this.context });
  }

  debug(message: any, context?: string) {
    this.logger.debug(message, { context: context || this.context });
  }

  verbose(message: any, context?: string) {
    this.logger.verbose(message, { context: context || this.context });
  }

  // Additional structured logging methods
  logWithMetadata(
    level: string,
    message: string,
    metadata: Record<string, any>,
  ) {
    this.logger.log(level, message, {
      context: this.context,
      ...metadata,
    });
  }

  logRequest(
    method: string,
    url: string,
    statusCode: number,
    duration: number,
    metadata?: Record<string, any>,
  ) {
    this.logger.info('HTTP Request', {
      context: 'HTTP',
      method,
      url,
      statusCode,
      duration,
      ...metadata,
    });
  }

  logError(error: Error, metadata?: Record<string, any>) {
    this.logger.error(error.message, {
      context: this.context,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      ...metadata,
    });
  }
}

