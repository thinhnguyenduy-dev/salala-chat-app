import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { utilities as nestWinstonModuleUtilities } from 'nest-winston';

const logDir = process.env.LOG_DIR || 'logs';
const logLevel = process.env.LOG_LEVEL || 'info';
const nodeEnv = process.env.NODE_ENV || 'development';

// Custom format for adding timestamp and formatting
const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DDTHH:mm:ss.SSSZ' }), // ISO 8601 with timezone
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// Console format for development (pretty print)
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.ms(),
  nestWinstonModuleUtilities.format.nestLike('SalalaAPI', {
    colors: true,
    prettyPrint: true,
  }),
);

// Daily rotate file transport for application logs
const applicationLogTransport = new DailyRotateFile({
  filename: `${logDir}/application-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  format: customFormat,
  level: logLevel,
});

// Daily rotate file transport for error logs
const errorLogTransport = new DailyRotateFile({
  filename: `${logDir}/error-%DATE%.log`,
  datePattern: 'YYYY-MM-DD',
  zippedArchive: true,
  maxSize: process.env.LOG_MAX_SIZE || '20m',
  maxFiles: process.env.LOG_MAX_FILES || '14d',
  format: customFormat,
  level: 'error',
});

// Console transport
const consoleTransport = new winston.transports.Console({
  format: nodeEnv === 'production' ? customFormat : consoleFormat,
  level: logLevel,
});

// Create transports array based on environment
const transports: winston.transport[] = [consoleTransport];

// Add file transports in production or when explicitly enabled
if (nodeEnv === 'production' || process.env.ENABLE_FILE_LOGGING === 'true') {
  transports.push(applicationLogTransport, errorLogTransport);
}

export const winstonConfig: winston.LoggerOptions = {
  level: logLevel,
  format: customFormat,
  transports,
  exitOnError: false,
  // Add default metadata
  defaultMeta: {
    service: 'salala-backend',
    environment: nodeEnv,
    pid: process.pid,
  },
};
