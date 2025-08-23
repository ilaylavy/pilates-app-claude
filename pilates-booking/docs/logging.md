# Logging System

Comprehensive logging for backend and mobile applications with error tracking and performance monitoring.

## Backend Logging

### Log Types
- **app.log**: General application events (7 days retention)
- **events.log**: Business events (365 days retention)
- **security.log**: Security events (365 days retention)
- **error.log**: Errors and exceptions (30 days retention)
- **access.log**: HTTP requests (30 days retention)

### Usage
```python
from app.core.logging_config import get_logger

logger = get_logger("app.booking")
logger.info("Booking created", user_id="123", booking_id="456")

# Business events
from app.services.business_logging_service import business_logger
business_logger.log_booking_created(
    user_id="123", 
    booking_id="456",
    credits_used=1
)

# Security events  
from app.services.security_logging_service import security_logger
security_logger.log_login_attempt(
    email="user@example.com",
    success=True,
    client_ip="192.168.1.100"
)
```

## Mobile Logging

### Categories
- **AUTH**: Authentication events
- **API**: API requests/responses
- **UI**: User interface interactions
- **BOOKING**: Booking operations
- **PAYMENT**: Payment processing
- **SECURITY**: Security events
- **PERFORMANCE**: Performance metrics

### Usage
```typescript
import { Logger, LogCategory } from '../services/LoggingService';

// Set user context
Logger.setUserId(user.id);
Logger.setCurrentScreen('BookingScreen');

// Category-based logging
Logger.info('Booking completed', { bookingId: '123' }, LogCategory.BOOKING);
Logger.error('Payment failed', error, { amount: 50 }, LogCategory.PAYMENT);

// Track user actions
Logger.trackScreenView('BookingScreen');
Logger.trackUserAction('button_press', 'book_class');
Logger.trackEvent('feature.used', { feature: 'class_filter' });
```

## Performance Monitoring

### Backend Metrics
```json
{
  "event_type": "api.request", 
  "path": "/api/v1/bookings",
  "response_time": 245,
  "slow_request": false
}
```

### Mobile Performance
```typescript
// Real-time performance overlay (dev mode)
import { usePerformanceOverlay } from '../components/PerformanceOverlay';

function App() {
  const { PerformanceOverlay } = usePerformanceOverlay(__DEV__);
  return (
    <View>
      <YourApp />
      <PerformanceOverlay />
    </View>
  );
}
```

## Error Handling

### Enhanced Error Boundaries
```typescript
import { ScreenErrorBoundary } from '../components/ErrorBoundary';

function App() {
  return (
    <ScreenErrorBoundary screenName="HomeScreen">
      <HomeScreen />
    </ScreenErrorBoundary>
  );
}
```

### Network Queue (Offline Support)
```typescript
import { networkQueue } from '../services/NetworkQueueService';

// Queue requests when offline
const queueId = await networkQueue.enqueue(
  '/api/v1/bookings',
  'POST', 
  { classId: 123 },
  { priority: 'high', maxRetries: 3 }
);
```

## Configuration

### Backend Settings
```env
LOG_LEVEL=INFO
LOG_FORMAT=json
LOG_RETENTION_DAYS=30

# External services
CLOUDWATCH_LOG_GROUP=pilates-api-logs
ELASTICSEARCH_URL=https://logs.example.com
```

### Sampling Rates
```typescript
// Configure category-specific sampling
Logger.setCategorySamplingRate(LogCategory.PERFORMANCE, 0.1); // 10%
Logger.setCategorySamplingRate(LogCategory.UI, 0.05);         // 5%
```

## Security & Privacy

### Automatic Masking
Sensitive data is automatically masked:
- Passwords, tokens, API keys
- Credit card numbers, CVV
- Personal identification numbers

### Data Retention
- Security logs: 365 days
- Payment logs: 365 days  
- Performance logs: 7 days
- UI interaction logs: 3 days

## Development Tools

### Dev Tools Screen
Access comprehensive debugging in development mode:
- Real-time log viewer with filtering
- Network queue monitoring
- Performance metrics dashboard
- Error simulation tools

### Log Analysis
```bash
# Find user actions
grep '"user_id":"user123"' backend/logs/events.log

# Check slow requests
grep '"slow_request":true' backend/logs/access.log

# Security events
grep '"threat_level":"high"' backend/logs/security.log
```

## Alerts & Monitoring

Key metrics to monitor:
- Error rate > 1% of requests
- Payment failures > 5 in 5 minutes
- Response time > 2 seconds  
- Failed logins > 10 in 1 minute

## Testing

```bash
# Backend tests
python verify_logging.py

# Mobile log testing
Logger.info('Test message', { test: true });
```