# Enhanced Logging System Documentation

## Overview

The Pilates Booking System implements a comprehensive, production-ready logging architecture with advanced error handling, performance monitoring, and debugging capabilities. The system provides complete visibility into application behavior, security events, business metrics, and system performance across both backend (FastAPI) and mobile (React Native) applications with centralized log management and structured data formats.

### Key Features
- **Enhanced Error Boundaries** with automatic recovery strategies
- **Comprehensive Performance Monitoring** with real-time metrics
- **Advanced Developer Tools** with interactive debugging interface
- **Offline-Capable Mobile Logging** with intelligent queuing
- **Privacy-Compliant Logging** with automatic sensitive data filtering
- **Category-Based Logging** with configurable sampling rates
- **Automatic Log Rotation** with retention policies
- **Real-time Performance Overlay** for development debugging

## Enhanced Architecture

```
┌─────────────────────────────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│              Mobile App                 │    │   Backend API   │    │ Log Aggregation │
│                                         │    │                 │    │   (External)    │
│ ┌─────────────────┐ ┌─────────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Error Boundary  │ │  Performance    │ │    │ │   Logger    │ │    │ │ CloudWatch  │ │
│ │   System        │ │   Monitor       │ │    │ │Middleware   │ │───▶│ │    ELK      │ │
│ │ • Recovery      │ │ • FPS Counter   │ │    │ │             │ │    │ │  Datadog    │ │
│ │ • Fallbacks     │ │ • Memory Usage  │ │    │ └─────────────┘ │    │ │  Sentry     │ │
│ └─────────────────┘ └─────────────────┘ │    │                 │    │ └─────────────┘ │
│                                         │    │ ┌─────────────┐ │    │                 │
│ ┌─────────────────┐ ┌─────────────────┐ │    │ │Log Files    │ │    │ ┌─────────────┐ │
│ │Enhanced Logger  │ │Network Queue    │ │    │ • Categories │ │    │ │Dashboards   │ │
│ │ • Categories    │ │ • Offline Queue │ │───▶│ • Rotation   │ │    │ • Real-time │ │
│ │ • Sampling      │ │ • Auto Retry    │ │    │ • Retention  │ │    │ • Alerts    │ │
│ │ • Filtering     │ │ • Prioritization│ │    │              │ │    │ • Analytics │ │
│ └─────────────────┘ └─────────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
│                                         │    │                 │    │                 │
│ ┌─────────────────┐ ┌─────────────────┐ │    │ ┌─────────────┐ │    │ ┌─────────────┐ │
│ │ Dev Tools       │ │Performance      │ │    │ │Remote       │ │    │ │Error        │ │
│ │ • Log Viewer    │ │ Overlay         │ │    │ │Logger       │ │    │ │Recovery     │ │
│ │ • Network Mon   │ │ • Draggable     │ │    │ │Service      │ │    │ │Reports      │ │
│ │ • Feature Flags │ │ • Real-time     │ │    │ │             │ │    │ │             │ │
│ └─────────────────┘ └─────────────────┘ │    │ └─────────────┘ │    │ └─────────────┘ │
└─────────────────────────────────────────┘    └─────────────────┘    └─────────────────┘
```

## Enhanced Log Types and Categories

### Mobile Log Categories (LogCategory Enum)

#### 1. AUTH - Authentication & Authorization
- User login/logout events
- Token refresh attempts
- Session management
- Permission violations
- Multi-factor authentication

#### 2. API - API Request/Response Logging
- Request/response details with timing
- Retry attempts and failures
- Rate limiting events
- API performance metrics
- Caching behavior

#### 3. UI - User Interface Events
- Screen navigation and transitions
- User interactions (taps, swipes, gestures)
- Form submissions and validation
- Component render times
- UI error states

#### 4. NAVIGATION - Navigation Events
- Screen transitions with timing
- Deep link handling
- Navigation state changes
- Route parameter passing
- Back navigation patterns

#### 5. PAYMENT - Payment Processing
- Payment initiation and completion
- Payment method selection
- Transaction status updates
- Payment failures and retries
- Refund processing

#### 6. SOCIAL - Social Features
- Profile interactions
- Social sharing events
- Comment and rating actions
- Community features usage
- Social authentication

#### 7. BOOKING - Booking Operations
- Class booking attempts
- Booking modifications/cancellations
- Waitlist management
- Credit usage tracking
- Booking conflict resolution

#### 8. PERFORMANCE - Performance Metrics
- Screen load times
- API response times
- Memory usage patterns
- Frame rate monitoring
- Network performance

#### 9. SECURITY - Security Events
- Suspicious activity detection
- Jailbreak/root detection
- Certificate pinning failures
- Data encryption events
- Security policy violations

#### 10. SYSTEM - System Events
- App lifecycle events (foreground/background)
- Network connectivity changes
- Device orientation changes
- Push notification handling
- System resource usage

#### 11. GENERAL - General Application Events
- Feature usage analytics
- User preferences changes
- Configuration updates
- Generic application flow
- Miscellaneous events

### Backend Log Types (Existing)

#### 1. Application Logs (`app.log`)
- General application flow and status
- API request/response details
- System startup/shutdown events
- Performance metrics

#### 2. Business Event Logs (`events.log`)
- User registration and authentication
- Booking creation, modification, cancellation
- Payment processing and refunds
- Package purchases and usage
- Class management operations
- Admin actions and bulk operations

#### 3. Security Event Logs (`security.log`)
- Authentication attempts (success/failure)
- Authorization violations
- Suspicious activity detection
- Admin access and privilege escalation
- Rate limiting violations
- Attack attempt detection

#### 4. Error Logs (`error.log`)
- Application errors and exceptions
- Failed API requests
- System failures and critical issues
- Stack traces and debugging information
- Error recovery attempts

#### 5. Access Logs (`access.log`)
- HTTP request details
- Response status codes
- Request timing and performance
- Client information (IP, User-Agent)

#### 6. Database Logs (`database.log`)
- Query execution times
- Slow query detection
- Connection pool metrics
- Transaction lifecycle events
- Migration operations

## Enhanced Log Structure

All logs use a structured JSON format for consistent parsing and analysis:

### Enhanced Mobile Log Entry
```json
{
  "id": "log-abc123def456",
  "timestamp": "2023-12-08T10:30:45.123Z",
  "level": "INFO",
  "category": "BOOKING",
  "message": "Class booking completed successfully",
  "context": {
    "userId": "user-789xyz",
    "sessionId": "sess-456uvw",
    "screen": "BookingScreen",
    "platform": "ios",
    "appVersion": "1.2.0",
    "deviceInfo": {
      "brand": "Apple",
      "model": "iPhone 14",
      "systemVersion": "16.0",
      "deviceId": "device-123abc",
      "isEmulator": false
    },
    "networkInfo": {
      "isConnected": true,
      "type": "wifi",
      "isInternetReachable": true
    }
  },
  "extra": {
    "bookingId": "booking-123abc",
    "classId": "class-456def",
    "credits_used": 1,
    "payment_method": "stripe",
    "booking_method": "mobile"
  },
  "breadcrumbs": [
    "2023-12-08T10:30:40.000Z [NAVIGATION] Navigated to BookingScreen",
    "2023-12-08T10:30:42.000Z [UI] Selected class 'Morning Yoga'",
    "2023-12-08T10:30:44.000Z [PAYMENT] Payment method selected"
  ],
  "samplingRate": 1.0,
  "stackTrace": null
}
```

### Backend Log Entry (Enhanced)
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
  "credits_used": 1,
  "performance_metrics": {
    "execution_time": 245,
    "database_queries": 3,
    "cache_hits": 2
  },
  "error_recovery": {
    "attempts": 0,
    "strategy_used": null
  }
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

## Enhanced Mobile Logging Implementation

### Enhanced Logger Service with Categories

Initialize and use the enhanced mobile logging service:

```typescript
import { Logger, LogCategory, setupGlobalErrorHandler } from '../services/LoggingService';
import { ErrorBoundary, ScreenErrorBoundary } from '../components/ErrorBoundary';
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';

// Setup global error handling with recovery
setupGlobalErrorHandler();

// Configure category-specific settings
Logger.setCategorySamplingRate(LogCategory.PERFORMANCE, 0.1); // 10% sampling
Logger.setCategorySamplingRate(LogCategory.UI, 0.05); // 5% sampling
Logger.setCategoryLogLevel(LogCategory.SECURITY, 'WARN'); // Only warnings and above

// Set user context
Logger.setUserId(user.id);
Logger.setCurrentScreen('HomeScreen');

// Enhanced logging with categories
Logger.info('User login completed', { loginMethod: 'email' }, LogCategory.AUTH);
Logger.error('Payment processing failed', error, { amount: 50 }, LogCategory.PAYMENT);
Logger.debug('Screen rendered', { renderTime: 245 }, LogCategory.UI);

// Category-specific convenience methods
Logger.logAuth('INFO', 'User authenticated', { method: 'biometric' });
Logger.logAPI('WARN', 'Slow API response', { endpoint: '/bookings', responseTime: 3500 });
Logger.logBooking('ERROR', 'Booking failed', { reason: 'class_full' });
Logger.logSecurity('CRITICAL', 'Jailbreak detected', { deviceId: 'device123' });

// Breadcrumb trail for debugging
Logger.addBreadcrumb('User opened booking screen', LogCategory.NAVIGATION);
Logger.addBreadcrumb('Selected class "Morning Yoga"', LogCategory.UI);
Logger.addBreadcrumb('Clicked book button', LogCategory.UI);
```

### Error Boundary Integration

Wrap components with enhanced error boundaries:

```typescript
import { ScreenErrorBoundary, ComponentErrorBoundary } from '../components/ErrorBoundary';

// Screen-level error boundary with automatic recovery
function App() {
  return (
    <ScreenErrorBoundary screenName="HomeScreen">
      <HomeScreen />
    </ScreenErrorBoundary>
  );
}

// Component-level error boundary for isolated failures
function BookingCard({ booking }) {
  return (
    <ComponentErrorBoundary 
      componentName="BookingCard"
      fallbackMessage="Unable to load booking details"
    >
      <BookingCardContent booking={booking} />
    </ComponentErrorBoundary>
  );
}
```

### Performance Monitoring Integration

Integrate performance monitoring throughout the app:

```typescript
import { usePerformanceMonitor } from '../hooks/usePerformanceMonitor';
import { PerformanceOverlay, usePerformanceOverlay } from '../components/PerformanceOverlay';

function HomeScreen() {
  const { trackScreenRender, trackImageLoad } = usePerformanceMonitor();
  const { PerformanceOverlay } = usePerformanceOverlay(__DEV__);
  
  // Track screen render time
  useEffect(() => {
    const cleanup = trackScreenRender('HomeScreen');
    return cleanup; // Called when component unmounts
  }, [trackScreenRender]);

  // Track image load performance
  const handleImageLoad = useCallback(() => {
    const cleanup = trackImageLoad('/api/images/class-photo.jpg');
    return cleanup;
  }, [trackImageLoad]);

  return (
    <View>
      <HomeContent onImageLoad={handleImageLoad} />
      {__DEV__ && <PerformanceOverlay />}
    </View>
  );
}
```

### Developer Tools Integration

Access comprehensive debugging tools:

```typescript
import { DevToolsScreen } from '../screens/DevToolsScreen';

// In development mode, provide access to dev tools
function DebugMenu() {
  const [showDevTools, setShowDevTools] = useState(false);
  
  if (!__DEV__) return null;
  
  return (
    <>
      <Button title="Dev Tools" onPress={() => setShowDevTools(true)} />
      <Modal visible={showDevTools}>
        <DevToolsScreen />
      </Modal>
    </>
  );
}
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

### Enhanced Retention Policies

#### Backend Logs
| Log Type | Retention Period | Reason |
|----------|------------------|---------|
| `app.log` | 7 days | General debugging |
| `error.log` | 30 days | Error investigation |
| `events.log` | 365 days | Business analytics |
| `security.log` | 365 days | Compliance and audit |
| `access.log` | 30 days | Traffic analysis |
| `database.log` | 7 days | Performance tuning |

#### Mobile Logs
| Category | Retention Period | Sampling Rate | Reason |
|----------|------------------|---------------|---------|
| `AUTH` | 30 days | 100% | Security compliance |
| `API` | 7 days | 100% | API debugging |
| `PAYMENT` | 365 days | 100% | Financial compliance |
| `BOOKING` | 90 days | 100% | Business analytics |
| `SECURITY` | 365 days | 100% | Security auditing |
| `PERFORMANCE` | 7 days | 10% | Performance optimization |
| `UI` | 3 days | 5% | User experience |
| `NAVIGATION` | 7 days | 30% | App flow analysis |
| `SOCIAL` | 30 days | 50% | Feature usage |
| `SYSTEM` | 7 days | 20% | Technical debugging |
| `GENERAL` | 7 days | 30% | General debugging |

#### Automatic Log Rotation
- **Mobile Logs**: Daily rotation at midnight local time
- **Category Filtering**: Automatic cleanup based on retention policies
- **Storage Optimization**: Compressed storage for older logs
- **Emergency Purge**: Automatic cleanup when storage exceeds limits

### Storage Requirements

Estimated daily log volumes (production):

- **app.log**: ~100MB/day
- **events.log**: ~50MB/day
- **security.log**: ~10MB/day
- **error.log**: ~20MB/day
- **access.log**: ~200MB/day
- **database.log**: ~30MB/day

**Total**: ~410MB/day (~12GB/month)

## Enhanced Developer Tools & Monitoring

### DevToolsScreen Features

Comprehensive debugging interface available in development mode:

#### Log Management
- **Real-time Log Viewer** with filtering and search
- **Category-based Filtering** (AUTH, API, UI, etc.)
- **Log Level Filtering** (DEBUG, INFO, WARN, ERROR, CRITICAL)
- **Export Functionality** for sharing logs
- **Log Statistics** and trend analysis

#### Network Monitoring
- **Queue Status Display** with real-time updates
- **Request Tracking** with retry attempts
- **Offline Request Management**
- **Network Performance Metrics**
- **Request Deduplication Monitoring**

#### Performance Dashboard
- **Real-time Metrics** (FPS, Memory, Network)
- **Performance Trend Graphs**
- **Slow Operation Detection**
- **Memory Leak Detection**
- **API Response Time Analysis**

#### Development Tools
- **Feature Flags Toggle** for A/B testing
- **Mock Data Controls** for testing
- **Error Simulation** for testing error handling
- **API Endpoint Switcher** for environment testing
- **Cache Management** (view/clear caches)

### PerformanceOverlay Component

Real-time performance monitoring overlay:

```typescript
import { usePerformanceOverlay } from '../components/PerformanceOverlay';

function App() {
  const { PerformanceOverlay } = usePerformanceOverlay(__DEV__);
  
  return (
    <View style={{ flex: 1 }}>
      <YourApp />
      <PerformanceOverlay 
        position="top-right"
        compact={false}
      />
    </View>
  );
}
```

#### Features
- **Draggable Interface** - Move anywhere on screen
- **Real-time FPS Counter** - Smooth at 60fps, warnings below 30fps
- **Memory Usage Monitor** - Shows JS heap usage and percentage
- **Network Queue Status** - Displays queued requests count
- **Expandable/Compact Modes** - Toggle between detailed and minimal views
- **Smart Positioning** - Snaps to screen edges
- **Development Only** - Automatically hidden in production

#### Performance Thresholds with Visual Indicators
- **FPS**: Green (55+), Yellow (30-54), Red (<30)
- **Memory**: Green (<50%), Yellow (50-80%), Red (>80%)
- **Network**: Orange indicator when requests are queued

### Error Monitoring Dashboard

Advanced error tracking and analysis:

#### Error Categories
- **Network Errors**: Connection issues, timeouts, offline scenarios
- **Authentication Errors**: Login failures, token issues, permissions
- **Validation Errors**: Form validation, data format issues
- **Server Errors**: 5xx responses, service unavailability
- **Client Errors**: App crashes, render failures, logic errors
- **Payment Errors**: Transaction failures, payment method issues

#### Recovery Statistics
- **Success Rate**: Percentage of errors successfully recovered
- **Recovery Methods**: Most effective recovery strategies
- **User Impact**: Errors visible to users vs. silent recovery
- **Time to Recovery**: Average time from error to recovery

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

## Enhanced Error Handling & Recovery

### Error Recovery Service

Automatic error recovery with multiple strategies:

```typescript
import { errorRecoveryService } from '../services/ErrorRecoveryService';

// Register custom recovery strategies
errorRecoveryService.registerStrategy({
  id: 'booking_error_recovery',
  name: 'Booking Error Recovery',
  description: 'Handles booking-specific errors',
  priority: 1,
  canRecover: (context) => context.screenName === 'BookingScreen',
  recover: async (context) => {
    // Custom recovery logic for booking errors
    return {
      success: true,
      action: 'retry_booking',
      message: 'Retrying booking with updated data',
      shouldRetry: true,
      retryDelay: 2000,
    };
  },
});

// Register fallback data providers
errorRecoveryService.registerFallbackDataProvider('HomeScreen', async () => {
  return {
    classes: await getCachedClasses(),
    bookings: await getCachedBookings(),
  };
});

// Manual error recovery
try {
  await makeApiCall();
} catch (error) {
  const result = await errorRecoveryService.recoverFromError(error, {
    screenName: 'BookingScreen',
    userId: user.id,
  });
  
  if (result.success) {
    Logger.info('Error recovered successfully', { action: result.action });
  }
}
```

### Enhanced Error Handlers

Categorized error handling with user-friendly messages:

```typescript
import { ErrorHandler, BookingErrorHandler, PaymentErrorHandler } from '../utils/errorHandlers';

// Handle API errors with automatic categorization
try {
  await apiCall();
} catch (error) {
  const categorized = await ErrorHandler.handleError(error, {
    screenName: 'BookingScreen',
    userId: user.id,
    action: 'create_booking',
  });
  
  if (ErrorHandler.shouldShowErrorToUser(categorized)) {
    showUserError(ErrorHandler.getErrorMessage(categorized));
  }
  
  // Show recovery actions to user
  const actions = ErrorHandler.getRecoveryActions(categorized);
  showRecoveryOptions(actions);
}

// Specialized error handling for bookings
const bookingErrorMessage = await BookingErrorHandler.handleBookingError(error, {
  classId: 123,
  userId: 456,
  packageId: 789,
});

// Specialized error handling for payments
const paymentErrorMessage = await PaymentErrorHandler.handlePaymentError(error, {
  amount: 50,
  paymentMethodId: 'pm_123',
  packageId: 789,
});
```

### Network Queue Service

Offline-capable request queuing with intelligent retry:

```typescript
import { networkQueue } from '../services/NetworkQueueService';

// Queue requests when offline with priority
const queueId = await networkQueue.enqueue(
  '/api/v1/bookings',
  'POST',
  { classId: 123, packageId: 456 },
  {
    priority: 'high', // high priority for bookings
    maxRetries: 3,
    exponentialBackoff: true,
    conflictKey: 'booking_123', // Handle duplicate requests
  }
);

// Monitor queue status
const status = networkQueue.getQueueStatus();
console.log(`Queue size: ${status.size}, Processing: ${status.processing}`);

// Configure queue settings
networkQueue.updateConfig({
  maxQueueSize: 200,
  batchSize: 10,
  retryIntervalMs: 3000,
});
```

## Enhanced Mobile Log Collection

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

## Recent Enhancements (v2.0)

### Major Features Added
- ✅ **Enhanced Error Boundaries** with automatic recovery strategies
- ✅ **Category-Based Logging** with 11 distinct categories and configurable sampling
- ✅ **Performance Monitoring** with real-time FPS, memory, and network tracking
- ✅ **Developer Tools Screen** with comprehensive debugging interface
- ✅ **Network Queue Service** for offline request handling and retry logic
- ✅ **Error Recovery Service** with pluggable recovery strategies
- ✅ **Performance Overlay** with draggable real-time performance monitoring
- ✅ **Enhanced Error Handlers** with user-friendly messages and recovery actions
- ✅ **Automatic Log Rotation** with category-based retention policies
- ✅ **Privacy-Compliant Logging** with automatic sensitive data filtering
- ✅ **Breadcrumb Trails** for enhanced error context and debugging
- ✅ **Request Deduplication** and intelligent caching for API calls

### Privacy & Security Enhancements
- **Automatic Data Sanitization**: Credit cards, emails, phones, tokens automatically redacted
- **GDPR Compliance**: Configurable data retention with automatic cleanup
- **Sampling Controls**: Reduce log volume for high-frequency events
- **Secure Storage**: All sensitive data properly masked before logging

### Performance Optimizations
- **Intelligent Sampling**: Reduced log volume for UI and performance events
- **Async Operations**: Non-blocking logging operations
- **Memory Management**: Automatic buffer management and cleanup
- **Network Optimization**: Batched log transmission and compression

### Developer Experience
- **Real-time Debugging**: Live log viewer with filtering and search
- **Visual Performance Monitoring**: Draggable overlay with FPS and memory tracking
- **Error Simulation**: Built-in tools for testing error scenarios
- **Feature Flags**: Toggle experimental features for testing
- **Network Monitoring**: Real-time queue status and request tracking

### Production Readiness
- **Zero Performance Impact**: Optimized for production with minimal overhead
- **Graceful Degradation**: App continues to function even if logging fails
- **Error Recovery**: Automatic recovery from common error scenarios
- **Monitoring Integration**: Ready for external log aggregation services
- **Compliance Ready**: Built-in data protection and retention policies

---

## Migration Guide from v1.0

### Breaking Changes
1. **Import Changes**: Update import statements to use new category-based logging
2. **Log Method Signatures**: Enhanced methods now accept category parameters
3. **Configuration**: New category-specific sampling and retention settings

### Recommended Upgrade Steps
1. **Update Dependencies**: Install new logging service components
2. **Wrap Components**: Add ErrorBoundary wrappers to key screens
3. **Enable Performance Monitoring**: Add PerformanceOverlay to development builds
4. **Configure Categories**: Set appropriate sampling rates for your use case
5. **Test Error Scenarios**: Use DevTools to simulate and test error handling

---

**Last Updated**: December 2023  
**Version**: 2.0.0  
**Previous Version**: 1.0.0  
**Next Review**: June 2024  
**Compatibility**: React Native 0.72+, TypeScript 4.9+, Expo SDK 49+