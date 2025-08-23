# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Documentation Structure

All detailed documentation is organized in the `docs/` folder:

- **[Mobile App Guide](docs/mobile-app.md)** - React Native architecture, patterns, security, and development workflow
- **[Testing Guide](docs/testing.md)** - Test setup, commands, best practices, and coverage requirements
- **[Package System](docs/packages.md)** - Credit-based booking system, business logic, and API endpoints
- **[Payment Integration](docs/payments.md)** - Stripe payment processing, security, and configuration
- **[Social Features](docs/social-features.md)** - Friend system, attendee display, calendar integration (planned)
- **[Security Implementation](docs/security.md)** - Authentication, authorization, data protection, and audit logging
- **[Logging System](docs/logging.md)** - Comprehensive logging, monitoring, error tracking, and performance metrics

Refer to these documents for detailed implementation guidance on specific features.

## Development Commands

### Essential Commands (use Makefile from project root)
```bash
# Initial setup
make setup              # Install all dependencies (backend + mobile)

# Development environment  
make up                 # Start Docker services (PostgreSQL, Redis, Backend)
make down               # Stop all services
make logs               # View all service logs

# Database operations
make migrate            # Run pending migrations
make seed               # Populate database with sample data
make reset-db           # Clean reset: drop volumes, migrate, seed

# Testing and quality
make test               # Run all tests (backend + mobile)
make test-backend       # Backend tests only  
make lint               # Lint all code
make lint-backend       # Backend linting (black, isort, flake8)
```

### Backend-Specific Commands
```bash
cd backend
python -m alembic revision --autogenerate -m "description"  # Create migration
python -m alembic upgrade head                               # Apply migrations
python -m pytest tests/ -v                                  # Run tests
python -m pytest tests/test_auth.py::test_login -v          # Single test
uvicorn app.main:app --reload                               # Start dev server
```

### Mobile-Specific Commands  
```bash
cd mobile
npm start                    # Start Expo dev server
npm run ios                  # iOS simulator
npm run android              # Android emulator 
npm test                     # Run Jest tests
npm test -- --watch         # Watch mode
npm run lint                 # ESLint + TypeScript check
```

### Debugging & Troubleshooting
```bash
# Backend debugging
docker-compose logs backend -f     # Follow backend logs
docker-compose exec backend bash   # Shell into backend container

# Mobile debugging  
npx expo start --clear             # Clear Metro cache
rm -rf node_modules && npm install # Reset mobile dependencies

# Database debugging
docker-compose exec postgres psql -U pilates_user -d pilates_db  # Connect to DB
```

## Architecture Overview

### Monorepo Structure
- **`backend/`**: FastAPI application with async SQLAlchemy, Alembic migrations
- **`mobile/`**: Expo React Native app with TypeScript
- **`docker-compose.yml`**: PostgreSQL, Redis, and backend services
- **`Makefile`**: Unified development commands across both applications

### Backend Architecture (FastAPI)

**Core Components:**
- **`app/main.py`**: FastAPI application entry point with CORS, lifespan events
- **`app/core/`**: Configuration (Pydantic Settings), database setup, security utilities
- **`app/api/v1/`**: API router structure with versioning (`/api/v1` prefix)
- **`app/models/`**: SQLAlchemy ORM models with relationships
- **`app/schemas/`**: Pydantic models for request/response validation
- **`app/services/`**: Business logic layer (AuthService, BookingService)

**Key Patterns:**
- **Async SQLAlchemy**: All database operations use `async`/`await`
- **Dependency Injection**: FastAPI's `Depends()` for database sessions, auth, role-based access
- **Role-Based Access Control**: `@require_roles(UserRole.ADMIN)` decorators
- **JWT Authentication**: Access + refresh token pattern with automatic refresh

**Authentication Flow:**
1. `deps.py` contains auth dependencies: `get_current_user`, `get_admin_user`, etc.
2. JWT tokens verified via `core/security.py`
3. Role-based endpoints use `require_roles()` dependency factory
4. Automatic token refresh in mobile app via axios interceptors

### Mobile Architecture (React Native + Expo)

**Core Components:**
- **`src/api/client.ts`**: Advanced Axios client with token refresh, caching, offline queuing
- **`src/hooks/useAuth.tsx`**: Authentication with biometric support
- **`src/navigation/Navigation.tsx`**: Role-based navigation (student/instructor/admin)
- **`src/services/`**: Business logic services (logging, network queue, error recovery)

**Key Patterns:**
- **Role-Based UI**: Different screens and features per user role
- **Offline-First**: Request queuing and sync when connection restored
- **Cash Payment Workflow**: Two-step approval system with real-time polling
- **Advanced Caching**: 5-minute API response cache with intelligent invalidation
- **Security Layers**: Biometric auth, auto-logout, secure storage, jailbreak detection
- **Performance Monitoring**: Real-time FPS, memory usage, and API call tracking

### Database Schema & Business Logic

**Core Models Relationships:**
```
User (1) -> (N) UserPackage (N) -> (1) Package
User (1) -> (N) Booking (N) -> (1) ClassInstance (N) -> (1) ClassTemplate  
User (1) -> (N) WaitlistEntry (N) -> (1) ClassInstance
ClassInstance (N) -> (1) User (instructor)
```

**Business Rules Enforced in Backend:**
- Weekly booking limits (`MAX_BOOKINGS_PER_WEEK` in config)
- Cancellation windows (`CANCELLATION_HOURS_LIMIT`) 
- Credit consumption/refunding in `UserPackage.use_credit()`
- Automatic waitlist promotion (`WAITLIST_AUTO_PROMOTION`)
- Package expiration logic in `UserPackage.is_valid`

### API Design Patterns

**Endpoint Structure:**
- Authentication: `/api/v1/auth/*` (register, login, refresh)
- Resources: `/api/v1/{resource}/` (classes, bookings, packages)
- Role-protected: Admin/instructor endpoints require role decorators
- Consistent error responses: HTTPException with standard status codes

**Database Patterns:**
- All models inherit from `Base` with naming conventions for constraints
- Async sessions via `get_db()` dependency
- Relationship loading handled via SQLAlchemy `relationship()` with proper lazy loading
- Alembic migrations in `alembic/versions/` with autogenerate

## Configuration Management

### Backend Configuration
- **Environment**: `app/core/config.py` uses Pydantic Settings
- **Key Settings**: Database URL, JWT secrets, business rules, CORS origins
- **Docker**: Environment variables passed through docker-compose
- **Security**: JWT_SECRET_KEY must be secure in production

### Mobile Configuration  
- **API Endpoint**: Set in `src/utils/config.ts` with backup URLs for reliability
- **Development**: Uses `192.168.99.110:8000` for physical device testing
- **Production**: Update `API_BASE_URL` for production deployment  
- **Expo Config**: `app.json` includes secure-store and local-authentication plugins
- **Security**: Biometric authentication and auto-logout configuration
- **Performance**: Real-time monitoring overlay available in development

## Key Features Overview

### Core Business Features
- **Credit-Based Booking**: Users purchase packages with credits to book classes
- **Real-Time Availability**: Live class capacity and waitlist management
- **Automatic Expiration**: Daily background tasks handle package expiration
- **Payment Processing**: Stripe integration with webhooks and refunds
- **Admin Management**: Comprehensive admin panel for users, classes, and packages

### Social Features
- **Friend System**: Send/accept friend requests, view mutual connections
- **Attendee Display**: See who's attending classes with avatar displays
- **Calendar Integration**: Automatic calendar sync with native device calendars
- **Privacy Controls**: Granular settings for social visibility

### Security & Compliance
- **JWT Authentication**: Secure token-based auth with automatic refresh
- **Role-Based Access**: Admin, instructor, and student role permissions
- **Audit Logging**: Complete audit trail for security and compliance
- **Rate Limiting**: Protection against abuse and attacks
- **Data Encryption**: Sensitive data encrypted at rest and in transit

### Testing Strategy
- **Backend**: Pytest with async fixtures, 80% coverage requirement
- **Mobile**: Jest + React Native Testing Library, 75% coverage
- **E2E**: Comprehensive end-to-end testing via Detox
- **Security**: Dedicated security test suite for auth and authorization

## Common Development Workflows

### Adding New Backend Endpoint
1. Create Pydantic schema in `schemas/`
2. Add endpoint to appropriate router in `api/v1/endpoints/`
3. Apply role-based access control if needed
4. Add business logic to `services/` if complex
5. Write tests in `tests/`

### Adding New Mobile Screen
1. Create screen component in `src/screens/`
2. Add navigation route in `src/navigation/Navigation.tsx`
3. Create API hooks if needed in `src/api/`
4. Add TypeScript types in `src/types/`
5. Test with React Native Testing Library

### Database Changes
1. Modify model in `models/`
2. Generate migration: `make migration` (prompts for message)
3. Review auto-generated migration in `alembic/versions/`
4. Apply migration: `make migrate`
5. Update seed data if needed in `app/scripts/seed_data.py`

### Mobile-Backend Integration
1. Mobile API client (`src/api/client.ts`) handles auth automatically
2. API endpoints return JSON matching TypeScript interfaces
3. TanStack Query manages caching and synchronization
4. Error handling via React Query error boundaries
5. Optimistic updates for better UX

## Important Notes

### Development Environment
- Backend runs on `localhost:8000`, mobile dev server on `localhost:8083`
- Database accessible at `localhost:5432`, Redis at `localhost:6379`
- Use `192.168.99.110:8000` for physical device testing (update in config.ts)
- Expo dev tools available at `http://localhost:8083`

### Production Considerations
- Set secure `SECRET_KEY` and database credentials
- Configure CORS origins for production domains
- Update mobile `API_BASE_URL` to production backend
- Use environment variables for all secrets
- Enable SSL/TLS for production API

### Code Quality Standards
- Backend: Black formatting, isort imports, flake8 linting
- Mobile: ESLint + TypeScript strict mode, Prettier formatting  
- All async functions properly handled with try/catch
- Proper error handling and user feedback in mobile app
- Database transactions for atomic operations

## Development Best Practices

### When Working on Features
1. **Check Documentation First**: Always refer to relevant docs in `docs/` folder
2. **Follow Existing Patterns**: Use established patterns from similar features
3. **Test Coverage**: Write tests for new features (see [Testing Guide](docs/testing.md))
4. **Security Considerations**: Review [Security Guide](docs/security.md) for sensitive features
5. **Error Handling**: Implement comprehensive error handling and logging

### Common Tasks
- **Mobile App Development**: See [Mobile App Guide](docs/mobile-app.md) for architecture and patterns
- **Payment Features**: Reference [Payment Integration](docs/payments.md) for Stripe integration
- **Package/Credit Logic**: Check [Package System](docs/packages.md) for business rules
- **Social Features**: See [Social Features](docs/social-features.md) (marked as planned, not yet implemented)
- **Security Implementation**: Review [Security Guide](docs/security.md) for auth and protection
- **Debugging Issues**: Use [Logging System](docs/logging.md) for troubleshooting
- **Adding Tests**: Follow [Testing Guide](docs/testing.md) patterns

### Mobile Development Specifics
- **Role-Based Features**: Different UI/features for student/instructor/admin roles
- **Cash Payments**: Two-step approval process with real-time status polling
- **Offline Support**: Use NetworkQueueService for offline-capable operations
- **Performance**: Enable PerformanceOverlay in development for monitoring
- **Security**: Implement biometric auth and auto-logout for sensitive features
- **API Caching**: Leverage 5-minute response cache for static data

### Performance Considerations
- Use database indexes for frequent queries
- Implement caching for expensive operations
- Follow async/await patterns throughout
- Monitor performance via logging system
- Use TanStack Query for client-side caching