# Logging System Documentation

## Overview

The Pilates Booking System implements a comprehensive logging architecture that provides complete visibility into application behavior, security events, business metrics, and system performance. The system supports both backend (FastAPI) and mobile (React Native) applications with centralized log management and structured data formats.

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Mobile App    │    │   Backend API   │    │ Log Aggregation │
│                 │    │                 │    │   (External)    │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │   Logger    │ │    │ │   Logger    │ │    │ │ CloudWatch  │ │
│ │  Service    │ │───▶│ │Middleware   │ │───▶│ │    ELK      │ │
│ │             │ │    │ │             │ │    │ │  Datadog    │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                 │    │                 │    │                 │
│ ┌─────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │Offline Queue│ │    │ │Log Files    │ │    │ │Dashboards   │ │
│ └─────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Log Types and Categories

### 1. Application Logs (`app.log`)
- General application flow and status
- API request/response details
- System startup/shutdown events
- Performance metrics

### 2. Business Event Logs (`events.log`)
- User registration and authentication
- Booking creation, modification, cancellation
- Payment processing and refunds
- Package purchases and usage
- Class management operations
- Admin actions and bulk operations

### 3. Security Event Logs (`security.log`)
- Authentication attempts (success/failure)
- Authorization violations
- Suspicious activity detection
- Admin access and privilege escalation
- Rate limiting violations
- Attack attempt detection

### 4. Error Logs (`error.log`)
- Application errors and exceptions
- Failed API requests
- System failures and critical issues
- Stack traces and debugging information

### 5. Access Logs (`access.log`)
- HTTP request details
- Response status codes
- Request timing and performance
- Client information (IP, User-Agent)

### 6. Database Logs (`database.log`)
- Query execution times
- Slow query detection
- Connection pool metrics
- Transaction lifecycle events
- Migration operations

## Log Structure

All logs use a structured JSON format for consistent parsing and analysis:

```json
{
  "timestamp": "2023-12-08T10:30:45.123Z",
  "level": "INFO",
  "service": "pilates-api",
  "environment": "production",
  "logger": "app.booking",
  "module": "booking_service",
  "function": "create_booking",
  "line": 142,
  "message": "Booking created successfully",
  "request_id": "req-abc123def456",
  "user_id": "user-789xyz",
  "session_id": "sess-456uvw",
  "event_type": "booking.created",
  "booking_id": "booking-123abc",
  "class_id": "class-456def",
  "credits_used": 1
}
```

### Required Fields
- `timestamp`: ISO 8601 formatted UTC timestamp
- `level`: Log level (DEBUG, INFO, WARN, ERROR, CRITICAL)
- `service`: Service name (pilates-api)
- `message`: Human-readable log message

### Context Fields
- `request_id`: Unique identifier for request tracing
- `user_id`: Authenticated user identifier
- `session_id`: User session identifier
- `environment`: Deployment environment

### Event-Specific Fields
- `event_type`: Standardized event type for business events
- `error`: Error details and stack traces
- `performance_metrics`: Timing and resource usage data

## Backend Logging Implementation

### Configuration

Logging is configured in `app/core/logging_config.py`:

```python
from app.core.logging_config import setup_logging, get_logger

# Initialize logging system
setup_logging()

# Get logger for specific component
logger = get_logger("app.booking")

# Log with context
logger.info("Processing booking request", 
           user_id="user123", 
           class_id="class456")
```

### Business Event Logging

Use the business event logger for tracking critical operations:

```python
from app.services.business_logging_service import business_logger

# Log user registration
business_logger.log_user_registered(
    user_id="user123",
    email="user@example.com",
    registration_method="web"
)

# Log booking creation
business_logger.log_booking_created(
    user_id="user123",
    class_id="class456",
    booking_id="booking789",
    credits_used=1,
    booking_method="mobile"
)

# Log payment success
business_logger.log_payment_success(
    user_id="user123",
    payment_id="payment456",
    amount=150.0,
    currency="ILS",
    payment_method="stripe"
)
```

### Security Event Logging

Track security-related events:

```python
from app.services.security_logging_service import security_logger

# Log login attempt
security_logger.log_login_attempt(
    email="user@example.com",
    success=True,
    client_ip="192.168.1.100",
    user_agent="Mozilla/5.0...",
    user_id="user123"
)

# Log admin access
security_logger.log_admin_access(
    admin_id="admin123",
    endpoint="/admin/users",
    action="view_users",
    client_ip="192.168.1.50",
    user_agent="Admin Browser"
)
```

### Request Context

Set request context for automatic inclusion in all logs:

```python
from app.core.logging_config import set_request_context

# In middleware or request handlers
set_request_context(
    request_id="req-abc123",
    user_id="user123",
    session_id="sess-456"
)
```

## Mobile Logging Implementation

### Logger Service

Initialize the mobile logging service:

```typescript
import { Logger, setupGlobalErrorHandler } from '../services/LoggingService';

// Setup global error handling
setupGlobalErrorHandler();

// Set user context
Logger.setUserId(user.id);

// Set current screen
Logger.setCurrentScreen('HomeScreen');

// Log events
Logger.info('User action completed', { action: 'book_class' });
Logger.error('API request failed', error, { endpoint: '/bookings' });
```

### React Hook Integration

Use the logging hook in React components:

```typescript
import { useLogging } from '../hooks/useLogging';

function BookingScreen() {
  const { log, track } = useLogging('BookingScreen');
  
  const handleBookClass = async () => {
    track.userAction('button_press', 'book_class');
    
    try {
      await bookClass();
      log.info('Class booked successfully');
      track.event('booking.completed', { classId: 'class123' });
    } catch (error) {
      log.error('Booking failed', error);
      track.error(error, 'booking_process');
    }
  };
  
  return (
    <Button onPress={handleBookClass}>Book Class</Button>
  );
}
```

### Event Tracking

Track user interactions and app events:

```typescript
// Screen views (automatic with useLogging hook)
Logger.trackScreenView('ProfileScreen', { userId: 'user123' });

// User actions
Logger.trackUserAction('button_press', 'logout_button');
Logger.trackUserAction('form_submit', 'registration_form', { success: true });

// API calls
Logger.trackApiCall('/api/v1/bookings', 'POST', 201, 245);

// Performance metrics
Logger.trackPerformance('screen_load_time', 1200, 'ms');

// Custom events
Logger.trackEvent('feature.used', {
  feature: 'class_filter',
  filterType: 'instructor',
  resultCount: 5
});
```

## Log File Management

### File Rotation

Logs are automatically rotated using `TimedRotatingFileHandler`:

- **Rotation**: Daily at midnight
- **Retention**: Varies by log type
- **Compression**: Optional (configure in production)
- **Naming**: `filename.YYYY-MM-DD`

### Retention Policies

| Log Type | Retention Period | Reason |
|----------|------------------|---------|
| `app.log` | 7 days | General debugging |
| `error.log` | 30 days | Error investigation |
| `events.log` | 365 days | Business analytics |
| `security.log` | 365 days | Compliance and audit |
| `access.log` | 30 days | Traffic analysis |
| `database.log` | 7 days | Performance tuning |

### Storage Requirements

Estimated daily log volumes (production):

- **app.log**: ~100MB/day
- **events.log**: ~50MB/day
- **security.log**: ~10MB/day
- **error.log**: ~20MB/day
- **access.log**: ~200MB/day
- **database.log**: ~30MB/day

**Total**: ~410MB/day (~12GB/month)

## Performance Monitoring

### Metrics Tracked

#### API Performance
```json
{
  "event_type": "api.request",
  "method": "POST",
  "path": "/api/v1/bookings",
  "status_code": 201,
  "response_time": 245,
  "slow_request": false
}
```

#### Database Performance
```json
{
  "event_type": "database.query",
  "operation": "SELECT",
  "table": "bookings",
  "execution_time": 0.123,
  "slow_query": false
}
```

#### Mobile Performance
```json
{
  "event_type": "mobile.performance",
  "metric": "screen_load_time",
  "value": 1200,
  "unit": "ms",
  "screen": "BookingScreen"
}
```

### Performance Thresholds

- **API Requests**: >1 second = slow
- **Database Queries**: >500ms = slow
- **Mobile Screen Load**: >2 seconds = slow
- **Mobile API Calls**: >5 seconds = timeout

## Security Features

### Sensitive Data Masking

Automatically masks sensitive information in logs:

```python
# Input
{"password": "secret123", "email": "user@example.com"}

# Logged
{"password": "***MASKED***", "email": "user@example.com"}
```

### Masked Fields
- password, token, secret, key
- authorization, refresh_token, access_token
- stripe_secret, credit_card, card_number, cvv
- ssn, social_security, api_key

### Security Event Detection

Automatic detection and logging of:

- Multiple failed login attempts (5+ in 5 minutes)
- Unusual access patterns (high frequency)
- Permission escalation attempts
- SQL injection attempts
- XSS attempts
- Rate limit violations

## Mobile Log Collection

### Endpoint: `POST /api/v1/logs/mobile`

Mobile apps send batched logs to the backend:

```json
{
  "logs": [
    {
      "id": "log-abc123",
      "timestamp": "2023-12-08T10:30:45.123Z",
      "level": "INFO",
      "message": "User logged in",
      "context": {
        "userId": "user123",
        "sessionId": "sess456",
        "platform": "ios",
        "appVersion": "1.0.0",
        "deviceInfo": {
          "brand": "Apple",
          "model": "iPhone 13",
          "systemVersion": "15.0"
        }
      }
    }
  ],
  "sessionId": "sess456",
  "deviceInfo": {...}
}
```

### Offline Support

Mobile logging includes offline capabilities:

- **Local Storage**: Logs stored in AsyncStorage
- **Batch Size**: Maximum 50 logs per batch
- **Buffer Size**: Maximum 1000 logs in memory
- **Retry Logic**: Automatic retry when network available
- **Flush Interval**: Every 30 seconds when online

## Monitoring and Alerting

### Recommended Alerts

#### Error Rate
```
Alert: Error rate > 1% of total requests
Query: COUNT(level="ERROR") / COUNT(*) > 0.01
```

#### Payment Failures
```
Alert: Payment failures > 5 in 5 minutes
Query: COUNT(event_type="payment.failed") > 5 in 5m
```

#### Slow Requests
```
Alert: Response time > 2 seconds
Query: AVG(response_time) > 2000
```

#### Failed Logins
```
Alert: Failed logins > 10 in 1 minute
Query: COUNT(event_type="auth.login_failed") > 10 in 1m
```

#### System Health
```
Alert: No logs received for 5 minutes
Query: COUNT(*) == 0 in 5m
```

### Dashboards

#### Application Health Dashboard
- Request count and error rate
- Response time percentiles (p50, p95, p99)
- Active user count
- API endpoint performance

#### Business Metrics Dashboard
- Daily bookings and revenue
- User registration trends
- Package sales performance
- Class popularity metrics

#### Security Dashboard
- Failed login attempts
- Admin action audit trail
- Suspicious activity alerts
- Geographic access patterns

## Log Analysis Examples

### Find All User Actions
```bash
grep '"user_id":"user123"' backend/logs/events.log | jq '.'
```

### Check API Performance
```bash
grep '"slow_request":true' backend/logs/access.log | jq '.path, .response_time'
```

### Security Event Summary
```bash
grep '"threat_level":"high"' backend/logs/security.log | jq '.event_type' | sort | uniq -c
```

### Database Performance Issues
```bash
grep '"slow_query":true' backend/logs/database.log | jq '.table, .execution_time'
```

### Mobile App Errors
```bash
grep '"platform":"ios"' backend/logs/app.log | grep '"level":"ERROR"' | jq '.message'
```

## Development vs Production

### Development Environment
- **Log Level**: DEBUG
- **Console Output**: Colored, formatted
- **File Rotation**: Disabled
- **Retention**: 3 days
- **Performance**: Optimized for debugging

### Production Environment
- **Log Level**: INFO
- **Console Output**: Minimal
- **File Rotation**: Daily
- **Retention**: Per policy above
- **Performance**: Optimized for throughput

## Configuration

### Environment Variables

```bash
# Logging configuration
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_RETENTION_DAYS=30

# External services
CLOUDWATCH_LOG_GROUP=pilates-api-logs
ELASTICSEARCH_URL=https://logs.example.com

# Mobile logging
MOBILE_LOG_BATCH_SIZE=50
MOBILE_LOG_FLUSH_INTERVAL=30000
```

### FastAPI Settings

```python
# app/core/config.py
class Settings(BaseSettings):
    LOG_LEVEL: str = "INFO"
    LOG_FORMAT: str = "json"
    LOG_RETENTION_DAYS: int = 30
    
    # External log services
    CLOUDWATCH_LOG_GROUP: Optional[str] = None
    ELASTICSEARCH_URL: Optional[str] = None
```

## Testing

### Backend Testing
```bash
# Run logging system tests
python verify_logging.py

# Test with real requests
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Monitor logs
tail -f backend/logs/app.log | jq '.'
```

### Mobile Testing
```typescript
// Test mobile logging
import { Logger } from '../services/LoggingService';

// Generate test logs
Logger.info('Test message', { test: true });
Logger.error('Test error', new Error('Test'), { test: true });
Logger.trackEvent('test.event', { action: 'testing' });

// Check local storage
import AsyncStorage from '@react-native-async-storage/async-storage';
const logs = await AsyncStorage.getItem('pilates_logs');
console.log(JSON.parse(logs));
```

## Troubleshooting

### Common Issues

#### Logs Not Appearing
1. Check log level configuration
2. Verify log directory permissions
3. Check disk space availability
4. Verify logger initialization

#### Performance Issues
1. Reduce log level in production
2. Check file rotation settings
3. Monitor disk I/O
4. Consider async logging

#### Mobile Logs Not Sending
1. Check network connectivity
2. Verify endpoint URL configuration
3. Check authentication tokens
4. Monitor batch size limits

### Debug Commands

```bash
# Check log file sizes
du -h backend/logs/*

# Monitor log creation in real-time
watch -n 1 'ls -la backend/logs/'

# Check log file permissions
ls -la backend/logs/

# Test log rotation
find backend/logs/ -name "*.log.*" -type f

# Check disk space
df -h
```

## Migration from Legacy Logging

### Steps to Migrate

1. **Backup Existing Logs**
   ```bash
   cp -r backend/logs backend/logs.backup
   ```

2. **Update Import Statements**
   ```python
   # Old
   from app.core.logging import get_logger
   
   # New
   from app.core.logging_config import get_logger
   ```

3. **Update Log Calls**
   ```python
   # Old
   logger.info(f"User {user_id} logged in")
   
   # New
   logger.info("User logged in", user_id=user_id)
   ```

4. **Test Migration**
   ```bash
   python verify_logging.py
   ```

## Best Practices

### Do's
- Use structured logging with context
- Include request IDs for tracing
- Log business events consistently
- Mask sensitive data automatically
- Set appropriate log levels
- Monitor log file sizes
- Use centralized log aggregation

### Don'ts
- Don't log sensitive information
- Don't use string formatting in log messages
- Don't ignore log rotation
- Don't log in tight loops without throttling
- Don't skip error context
- Don't use synchronous logging in hot paths

### Example of Good Logging
```python
# Good: Structured with context
logger.info(
    "Booking created successfully",
    user_id=user.id,
    class_id=class_instance.id,
    booking_id=booking.id,
    credits_used=package.credits_per_class,
    booking_method="web"
)

# Bad: String formatting without context
logger.info(f"User {user.id} booked class {class_instance.id}")
```

## Support and Maintenance

### Regular Tasks
- Monitor log file sizes weekly
- Review error trends monthly
- Update retention policies quarterly
- Test log aggregation pipeline monthly
- Audit security events weekly

### Emergency Procedures
- Log disk space alerts: Increase retention or add storage
- High error rates: Check application health and recent deployments
- Security alerts: Investigate and potentially block sources
- Performance degradation: Review slow query and request logs

### Contact Information
- **Development Team**: dev@pilates-booking.com
- **Security Team**: security@pilates-booking.com
- **Operations Team**: ops@pilates-booking.com

---

**Last Updated**: December 2023  
**Version**: 1.0.0  
**Next Review**: March 2024