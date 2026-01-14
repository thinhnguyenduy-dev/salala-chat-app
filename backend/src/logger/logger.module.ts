import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '../config/logger.config';
import { CustomLoggerService } from './logger.service';

@Global()
@Module({
  imports: [WinstonModule.forRoot(winstonConfig)],
  providers: [CustomLoggerService],
  exports: [CustomLoggerService, WinstonModule],
})
export class LoggerModule {}
