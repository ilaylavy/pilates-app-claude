# Pilates Studio Booking System

A production-ready monorepo containing a FastAPI backend and React Native Expo mobile app for managing pilates studio bookings, class schedules, and credit packages.

## 🚀 Features

### Backend (FastAPI)
- **Authentication & Authorization**: JWT tokens with role-based access (student, instructor, admin)
- **Class Management**: Templates for recurring classes and instances for specific sessions
- **Booking System**: Atomic transactions with credit management and waitlist functionality
- **Package System**: Credit-based packages with expiration handling
- **Business Logic**: Weekly booking limits, cancellation policies, automatic waitlist promotion
- **Database**: PostgreSQL with SQLAlchemy ORM and Alembic migrations
- **Caching**: Redis for session management and performance optimization

### Mobile App (React Native Expo)
- **Cross-platform**: iOS and Android support with Expo SDK 50+
- **Authentication**: Complete auth flow with biometric authentication option
- **Real-time Updates**: TanStack Query for efficient server state management
- **Offline Support**: Optimistic updates and offline-first architecture
- **Modern UI**: TypeScript, React Navigation v6, and responsive design
- **Push Notifications**: Expo Push Notifications setup for class reminders

## 📋 Prerequisites

- **Node.js** 18+ and npm/yarn
- **Python** 3.11+
- **Docker** and Docker Compose
- **Expo CLI** (`npm install -g @expo/cli`)

## 🛠️ Quick Start

### 1. Clone and Setup

```bash
git clone <repository-url>
cd pilates-booking

# Install dependencies
make setup
```

### 2. Environment Configuration

```bash
# Backend
cd backend
cp .env.example .env
# Edit .env with your database and security settings

# Mobile (if needed)
cd ../mobile
# Update src/utils/config.ts for your API endpoint
```

### 3. Start Development Environment

```bash
# Start all services (PostgreSQL, Redis, Backend)
make up

# In a new terminal, start the mobile app
cd mobile
npm start
```

### 4. Database Setup

```bash
# Create and run migrations
make migrate

# Seed with sample data
make seed
```

## 📱 Development Workflow

### Backend Development

```bash
# Start backend only
cd backend
uvicorn app.main:app --reload

# Run tests
make test-backend

# Code formatting
make lint-backend

# Create new migration
make migration

# Apply migrations
make migrate
```

### Mobile Development

```bash
cd mobile

# Start Expo development server
npm start

# Run on specific platform
npm run ios     # iOS simulator
npm run android # Android emulator
npm run web     # Web browser

# Run tests
npm test

# Code formatting
npm run lint
```

## 🏗️ Project Structure

```
pilates-booking/
├── backend/                 # FastAPI backend
│   ├── app/
│   │   ├── api/v1/         # API routes and endpoints
│   │   ├── core/           # Configuration and database
│   │   ├── models/         # SQLAlchemy models
│   │   ├── schemas/        # Pydantic schemas
│   │   ├── services/       # Business logic
│   │   └── main.py         # FastAPI application
│   ├── alembic/            # Database migrations
│   ├── tests/              # Backend tests
│   └── requirements.txt    # Python dependencies
├── mobile/                 # React Native Expo app
│   ├── src/
│   │   ├── api/            # API client and endpoints
│   │   ├── components/     # Reusable UI components
│   │   ├── screens/        # App screens
│   │   ├── navigation/     # Navigation configuration
│   │   ├── hooks/          # Custom React hooks
│   │   ├── utils/          # Utilities and config
│   │   └── types/          # TypeScript type definitions
│   ├── app.json            # Expo configuration
│   └── package.json        # Node dependencies
├── docker-compose.yml      # Development services
├── Makefile               # Development commands
└── README.md              # This file
```

## 🔐 Authentication & Security

### Backend Security Features
- JWT access and refresh tokens
- Bcrypt password hashing
- Role-based access control (RBAC)
- Input validation with Pydantic
- SQL injection prevention
- CORS configuration
- Rate limiting on auth endpoints

### Mobile Security Features
- Secure token storage with Expo SecureStore
- Automatic token refresh
- Biometric authentication option
- API request signing
- Deep linking security

## 📊 Database Schema

### Core Models

1. **User**: Authentication and profile information
2. **ClassTemplate**: Recurring class definitions
3. **ClassInstance**: Specific class occurrences
4. **Package**: Credit packages for purchase
5. **UserPackage**: User's purchased packages
6. **Booking**: Class reservations
7. **WaitlistEntry**: Waitlist management
8. **Payment**: Transaction records

### Business Rules

- **Booking Limits**: Max 10 bookings per week (configurable)
- **Cancellation Policy**: 2-hour minimum cancellation window
- **Waitlist**: Automatic promotion when spots open
- **Package Expiration**: Time-based credit expiration
- **Class Capacity**: Configurable per class template

## 🧪 Testing

### Backend Testing

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=app --cov-report=html

# Run specific test file
pytest tests/test_auth.py -v
```

### Mobile Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm test -- --coverage

# Run E2E tests (when configured)
npx detox test
```

## 🚀 Deployment

### Backend Deployment

1. **Environment Variables**: Configure production settings
2. **Database**: Set up PostgreSQL and Redis instances
3. **Docker**: Use provided Dockerfile for containerization
4. **Secrets**: Secure JWT secret key and database credentials

```bash
# Production build
docker build -t pilates-backend ./backend

# Run with environment variables
docker run -e DATABASE_URL=... -e SECRET_KEY=... pilates-backend
```

### Mobile Deployment

1. **Build Configuration**: Update `app.json` for production
2. **API Endpoint**: Configure production API URL
3. **App Store**: Follow Expo's guide for app store submission

```bash
# Build for production
npx expo build:ios
npx expo build:android

# Or use EAS Build
npx eas build --platform all
```

## 📋 API Documentation

The FastAPI backend automatically generates interactive API documentation:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **OpenAPI Schema**: http://localhost:8000/openapi.json

### Key Endpoints

#### Authentication
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login
- `POST /api/v1/auth/refresh` - Token refresh

#### Classes
- `GET /api/v1/classes/upcoming` - Get upcoming classes
- `GET /api/v1/classes/{id}` - Get class details

#### Bookings
- `POST /api/v1/bookings/create` - Create booking
- `DELETE /api/v1/bookings/{id}/cancel` - Cancel booking
- `GET /api/v1/bookings` - Get user bookings

#### Packages
- `GET /api/v1/packages` - Get available packages
- `POST /api/v1/packages/purchase` - Purchase package
- `GET /api/v1/packages/my-packages` - Get user packages

## 🔧 Configuration

### Backend Configuration (`backend/.env`)

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/pilates_db

# Security
SECRET_KEY=your-super-secret-key
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Business Rules
MAX_BOOKINGS_PER_WEEK=10
CANCELLATION_HOURS_LIMIT=2
```

### Mobile Configuration (`mobile/src/utils/config.ts`)

```typescript
export const API_BASE_URL = __DEV__ 
  ? 'http://localhost:8000/api/v1'
  : 'https://your-api.com/api/v1';
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow TypeScript best practices
- Write tests for new features
- Update documentation for API changes
- Use conventional commit messages
- Ensure code passes linting and tests

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:

1. Check the [Issues](../../issues) page
2. Review the API documentation at `/docs`
3. Consult the troubleshooting section below

## 🔍 Troubleshooting

### Common Issues

#### Backend Issues

**Database Connection Errors**
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Reset database
make reset-db
```

**Migration Errors**
```bash
# Reset migrations
alembic downgrade base
alembic upgrade head
```

#### Mobile Issues

**Metro Bundle Errors**
```bash
# Clear Metro cache
npx expo start --clear

# Reset node modules
rm -rf node_modules && npm install
```

**Authentication Issues**
- Check API endpoint configuration
- Verify backend is running
- Check network connectivity

### Performance Optimization

- Use Redis for caching frequently accessed data
- Implement database connection pooling
- Add database indexes for common queries
- Use React Query for client-side caching
- Implement lazy loading for screens

## 📚 Documentation

Detailed documentation is organized in the `docs/` folder:

- [Mobile App Guide](docs/mobile-app.md) - React Native architecture, patterns, and development workflow
- [Testing Guide](docs/testing.md) - Testing setup and best practices
- [Package System](docs/packages.md) - Credit-based booking system
- [Payment Integration](docs/payments.md) - Stripe payment processing
- [Social Features](docs/social-features.md) - Friend system and social booking (planned)
- [Security Implementation](docs/security.md) - Security measures and configuration
- [Logging System](docs/logging.md) - Comprehensive logging and monitoring

## 🎯 Roadmap

- [ ] Email notifications for class reminders
- [ ] Advanced analytics dashboard
- [ ] Multi-studio support
- [ ] Instructor mobile app
- [ ] Calendar synchronization
- [ ] Enhanced social features and reviews