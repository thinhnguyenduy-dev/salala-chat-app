import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { CustomLoggerService } from './logger.service';

// Extend Express Request type to include requestId
interface RequestWithId extends Request {
  requestId?: string;
}

@Injectable()
export class HttpLoggerMiddleware implements NestMiddleware {
  constructor(private readonly logger: CustomLoggerService) {
    this.logger.setContext('HTTP');
  }

  use(req: RequestWithId, res: Response, next: NextFunction) {
    const { method, originalUrl, ip, headers } = req;
    const userAgent = headers['user-agent'] || '';
    const startTime = Date.now();

    // Generate request ID for correlation
    const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    req.requestId = requestId;

    // Log request
    this.logger.logWithMetadata('info', 'Incoming Request', {
      method,
      url: originalUrl,
      ip,
      userAgent,
      requestId,
    });

    // Capture response
    res.on('finish', () => {
      const { statusCode } = res;
      const duration = Date.now() - startTime;
      const contentLength = res.get('content-length') || 0;

      this.logger.logRequest(method, originalUrl, statusCode, duration, {
        ip,
        userAgent,
        requestId,
        contentLength,
      });
    });

    next();
  }
}
