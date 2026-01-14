# Production Logging System

This backend uses **Winston** for structured logging with **Grafana Loki** for log aggregation and visualization.

## Features

- ✅ **Structured JSON Logging** - Easy parsing for log aggregation tools
- ✅ **Daily Log Rotation** - Automatic rotation with configurable retention (default: 14 days)
- ✅ **HTTP Request Logging** - All requests logged with correlation IDs
- ✅ **Error Tracking** - Automatic error logging with stack traces
- ✅ **Environment-Aware** - Pretty console logs in dev, JSON in production
- ✅ **Grafana Loki Integration** - Optional log aggregation and visualization

## Configuration

Add these environment variables to your `.env` file:

```env
# Logging Configuration
LOG_LEVEL=info              # debug, info, warn, error
LOG_DIR=logs                # Directory for log files
LOG_MAX_FILES=14d           # Retention period (14 days)
LOG_MAX_SIZE=20m            # Max file size before rotation
ENABLE_FILE_LOGGING=true    # Enable file logging (auto-enabled in production)
NODE_ENV=development        # development or production
```

## Log Files

Logs are written to the `logs/` directory:

- `application-YYYY-MM-DD.log` - All application logs
- `error-YYYY-MM-DD.log` - Error logs only

## Log Format

### Development (Console)
```
[2026-01-13 18:12:13.123] INFO [NotificationService]: Firebase initialized
```

### Production (JSON)
```json
{
  "timestamp": "2026-01-13 18:12:13.123",
  "level": "info",
  "context": "NotificationService",
  "message": "Firebase initialized",
  "service": "salala-backend",
  "environment": "production",
  "pid": 12345
}
```

### HTTP Request Log
```json
{
  "timestamp": "2026-01-13 18:12:13.456",
  "level": "info",
  "context": "HTTP",
  "method": "POST",
  "url": "/api/chat/messages",
  "statusCode": 201,
  "duration": 45,
  "ip": "192.168.1.1",
  "requestId": "req-1705161133456-abc123"
}
```

## Using the Logger in Your Code

```typescript
import { Injectable } from '@nestjs/common';
import { CustomLoggerService } from '../logger/logger.service';

@Injectable()
export class YourService {
  private readonly logger = new Logger(YourService.name);

  constructor() {}

  someMethod() {
    // Basic logging
    this.logger.log('Something happened');
    this.logger.error('Error occurred', error.stack);
    this.logger.warn('Warning message');
    this.logger.debug('Debug info');

    // Structured logging with metadata
    this.logger.logWithMetadata('info', 'User action', {
      userId: '123',
      action: 'login',
      timestamp: new Date(),
    });

    // Error logging with metadata
    this.logger.logError(error, {
      userId: '123',
      operation: 'payment',
    });
  }
}
```

## Grafana Loki Setup (Optional)

### Start Loki Stack

```bash
cd backend
docker-compose -f docker-compose.logging.yml up -d
```

This starts:
- **Loki** (port 3100) - Log aggregation
- **Promtail** - Log shipping from files to Loki
- **Grafana** (port 3001) - Visualization dashboard

### Access Grafana

1. Open http://localhost:3001
2. Navigate to **Explore** (compass icon)
3. Select **Loki** datasource
4. Query your logs using LogQL

### Example LogQL Queries

```logql
# All logs
{job="salala-backend"}

# Error logs only
{job="salala-backend"} |= "error"

# Logs from specific context
{job="salala-backend", context="NotificationService"}

# HTTP requests with status 500
{job="salala-backend", context="HTTP"} | json | statusCode="500"

# Logs in the last 5 minutes
{job="salala-backend"} [5m]
```

### Stop Loki Stack

```bash
docker-compose -f docker-compose.logging.yml down
```

## Production Deployment

### With Loki (Recommended)

1. Deploy Loki stack to your infrastructure
2. Update Promtail config with your backend log path
3. Configure Grafana datasource to point to Loki
4. Set up alerts and dashboards in Grafana

### Without Loki (File-based)

Logs are automatically written to files. You can:
- Use log rotation to manage disk space
- Ship logs to CloudWatch, Datadog, or other platforms
- Parse JSON logs with tools like `jq`:

```bash
# View all error logs
cat logs/error-*.log | jq '.message, .error'

# Filter by context
cat logs/application-*.log | jq 'select(.context == "HTTP")'

# Count requests by status code
cat logs/application-*.log | jq -r '.statusCode' | sort | uniq -c
```

## Troubleshooting

### Logs not appearing in files

1. Check `ENABLE_FILE_LOGGING=true` in `.env`
2. Verify `logs/` directory exists and is writable
3. Check `NODE_ENV` is set correctly

### Loki not receiving logs

1. Ensure backend is writing JSON logs to `logs/` directory
2. Check Promtail is running: `docker-compose -f docker-compose.logging.yml ps`
3. View Promtail logs: `docker-compose -f docker-compose.logging.yml logs promtail`
4. Verify log file path in `promtail-config.yaml` matches your setup

### High disk usage

1. Reduce `LOG_MAX_FILES` retention period
2. Reduce `LOG_MAX_SIZE` per file
3. Lower `LOG_LEVEL` to `warn` or `error` in production
