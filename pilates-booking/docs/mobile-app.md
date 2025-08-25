# Mobile App Guide

Comprehensive guide for the React Native Expo mobile application.

## Architecture Overview

### Technology Stack
- **React Native + Expo SDK 53**
- **TypeScript** with strict mode
- **TanStack Query** for server state management
- **React Navigation v6** with role-based routing
- **Stripe React Native** for payments
- **Expo SecureStore + Local Authentication** for security

### Key Configuration
```json
// app.json
{
  "plugins": [
    "expo-secure-store",
    ["expo-local-authentication", {
      "faceIDPermission": "Enable biometric authentication"
    }]
  ]
}
```

## Core Features

### Authentication System
```typescript
// Multi-layered security
- JWT tokens with automatic refresh
- Biometric authentication (Face ID/Touch ID)
- Auto-logout after 15 minutes inactivity
- Multi-device session management
- Secure token storage via Expo SecureStore
```

### Role-Based Navigation
Three distinct user experiences:
- **Students**: Booking, packages, profile
- **Instructors**: Schedule management, attendance
- **Admins**: Full system management, analytics

### API Client Architecture
```typescript
// src/api/client.ts features:
- Automatic token refresh with mutex
- Request deduplication (prevents duplicate calls)
- 5-minute response caching for static data
- Offline request queuing
- Exponential backoff retry logic
- Comprehensive error handling
```

## Key Implementation Patterns

### State Management
```typescript
// TanStack Query configuration
- Optimistic updates for bookings
- 30-second stale time for cash payment polling
- Automatic background refetch
- Cache invalidation strategies
```

### Cash Payment Workflow
**Two-Step Approval Process:**
1. **Authorization**: Admin authorizes payment method
2. **Payment Confirmation**: Admin confirms payment received
3. **Real-time Polling**: Client polls for status updates
4. **Optimistic Updates**: UI updates immediately with rollback capability

### Offline Capabilities
```typescript
// Network Queue Service
- Queues requests when offline
- Intelligent retry with exponential backoff
- Priority-based request handling
- Background sync when connection restored
- Request deduplication and caching
```

### Security Implementation
```typescript
// Security Manager features:
- Biometric authentication setup
- Jailbreak/root detection
- Background app data clearing
- Auto-logout timers
- Secure storage management
```

## Directory Structure

```
mobile/src/
├── api/           # API layer with comprehensive client
├── components/    # Reusable UI components
│   ├── common/    # Base components (Button, Input)
│   ├── schedule/  # Schedule management components
│   └── modals/    # Specialized modal components
├── hooks/         # Custom React hooks
│   ├── useAuth.tsx          # Authentication state
│   ├── useBookings.ts       # Booking operations
│   ├── useLogging.tsx       # Logging integration
│   └── usePerformanceMonitor.ts # Performance tracking
├── navigation/    # Role-based navigation setup
├── screens/       # Screen components by feature
│   ├── auth/      # Authentication screens
│   └── admin/     # Admin-specific screens
├── services/      # Business logic services
│   ├── LoggingService.ts    # Comprehensive logging
│   ├── NetworkQueueService.ts # Offline capabilities
│   └── ErrorRecoveryService.ts # Error handling
├── types/         # TypeScript definitions
└── utils/         # Utilities and configuration
```

## Development Workflow

### Environment Setup
```typescript
// src/utils/config.ts
export const API_BASE_URL = __DEV__ 
  ? 'http://192.168.99.110:8000/api/v1'  // Development IP
  : 'https://production-api.com/api/v1';

// Backup URLs for connection issues
export const BACKUP_API_URLS = [
  'http://localhost:8000/api/v1',
  'http://10.0.2.2:8000/api/v1'  // Android emulator
];
```

### Key Commands
```bash
npm start          # Expo development server
npm run android    # Android emulator  
npm run ios        # iOS simulator
npm test           # Jest test suite
npm run lint       # ESLint + TypeScript check

# Debug utilities (available in __DEV__)
clearTokens()      # Global function to clear stored tokens
```

### Testing Infrastructure
```typescript
// Comprehensive test setup:
- Unit tests with Jest + React Native Testing Library
- Mock Service Worker for API mocking
- Custom render utilities with auth providers
- 70-80% coverage requirements
- E2E testing setup with Detox (configured)
```

## Performance Monitoring

### Performance Overlay
```typescript
// Development-only real-time performance monitoring
import { usePerformanceOverlay } from '../components/PerformanceOverlay';

function App() {
  const { PerformanceOverlay } = usePerformanceOverlay(__DEV__);
  return (
    <View>
      <YourApp />
      <PerformanceOverlay />  {/* Draggable FPS/Memory monitor */}
    </View>
  );
}
```

### Monitoring Features
- **Real-time FPS counter**
- **Memory usage tracking**  
- **API response time monitoring**
- **Network queue status**
- **Slow request detection** (>3 seconds)

## Error Handling Strategy

### Centralized Error Management
```typescript
// User-friendly error messages
- Network errors: "Check your connection"
- Authentication errors: "Please log in again"
- Booking errors: "Class may be full"
- Payment errors: "Payment method issue"

// Error recovery strategies
- Automatic retry for network failures
- Token refresh for auth errors
- Fallback UI for component failures
- Offline queue for failed requests
```

## Advanced Features

### Logging Integration
```typescript
// Comprehensive mobile logging
import { Logger, LogCategory } from '../services/LoggingService';

Logger.info('User action', { screen: 'BookingScreen' }, LogCategory.UI);
Logger.trackUserAction('button_press', 'book_class');
Logger.trackScreenView('BookingScreen');
```

### Cache Management
```typescript
// Intelligent caching strategies
- API responses: 5-minute cache
- User data: Session-based cache
- Images: Persistent cache
- Offline data: Local storage with TTL
```

## Security Considerations

### Data Protection
- **Biometric authentication** for app access
- **Secure token storage** in device keychain
- **Background app blurring** to hide sensitive data
- **Auto-logout** on inactivity
- **Certificate pinning** (ready for implementation)

### Development Security
- **No sensitive data in logs** during development
- **Debug functions** only available in __DEV__
- **Production key validation**
- **Secure API communication**

## Troubleshooting

### Common Issues
- **Metro cache issues**: `npx expo start --clear`
- **Token refresh failures**: Check network and API connectivity
- **Biometric setup**: Verify device enrollment and permissions
- **Offline sync**: Check NetworkQueueService logs

### Debug Tools
```typescript
// Available in development
console.log('Queue status:', networkQueue.getStatus());
console.log('Auth state:', useAuth());
Logger.exportLogs(); // Export logs for analysis
```

## Production Considerations

### Performance
- **Lazy loading** for screens
- **Image optimization** and caching
- **Bundle size monitoring**
- **Memory leak detection**

### Security
- **Production API URLs**
- **SSL certificate pinning**
- **Store compliance** (iOS App Store, Google Play)
- **Security audit** before release

This mobile app demonstrates enterprise-level architecture with comprehensive security, offline capabilities, and user experience optimization.