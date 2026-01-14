import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { CustomLoggerService } from './logger.service';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('LoggingInterceptor');
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const { method, url } = request;
    const requestId = request['requestId'] || 'unknown';
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        this.logger.logWithMetadata(
          'debug',
          `${method} ${url} completed in ${duration}ms`,
          {
            requestId,
            duration,
          },
        );
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const status =
          error instanceof HttpException
            ? error.getStatus()
            : HttpStatus.INTERNAL_SERVER_ERROR;

        const errorResponse =
          error instanceof HttpException ? error.getResponse() : error.message;

        this.logger.logWithMetadata('error', 'Request failed', {
          method,
          url,
          status,
          duration,
          requestId,
          stack: error.stack,
          error: {
            name: error.name,
            message: error.message,
            response: errorResponse,
          },
        });

        return throwError(() => error);
      }),
    );
  }
}
