# Testing Guide - Pilates Booking System

This comprehensive guide covers all aspects of testing in the Pilates Booking System, including backend API testing, mobile app testing, and end-to-end testing strategies.

## Table of Contents

1. [Testing Philosophy](#testing-philosophy)
2. [Test Structure Overview](#test-structure-overview)
3. [Backend Testing](#backend-testing)
4. [Mobile Testing](#mobile-testing)
5. [End-to-End Testing](#end-to-end-testing)
6. [CI/CD Integration](#cicd-integration)
7. [Coverage Requirements](#coverage-requirements)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

## Testing Philosophy

Our testing strategy follows the **Testing Pyramid** approach:

```
        /\
       /  \      E2E Tests (Few, High Confidence)
      /____\
     /      \    Integration Tests (Some, Moderate Speed)
    /__________\  Unit Tests (Many, Fast)
```

### Test Categories

- **Unit Tests**: Fast, isolated tests of individual components/functions
- **Integration Tests**: Tests of component interactions and API endpoints
- **End-to-End Tests**: Full user journey tests across the entire system
- **Security Tests**: Tests for authentication, authorization, and vulnerabilities
- **Performance Tests**: Load testing and performance benchmarks

## Test Structure Overview

```
pilates-booking/
├── backend/
│   ├── tests/
│   │   ├── unit/           # Fast, isolated tests
│   │   ├── integration/    # API and service integration tests
│   │   ├── e2e/           # Full journey tests
│   │   ├── fixtures/      # Reusable test data
│   │   ├── factories/     # Test data factories
│   │   ├── mocks/         # Mock services
│   │   └── conftest.py    # Pytest configuration
│   └── pytest.ini        # Test configuration
├── mobile/
│   ├── tests/
│   │   ├── unit/          # Component and utility tests
│   │   ├── integration/   # Screen and flow tests
│   │   ├── e2e/          # Detox E2E tests
│   │   ├── __mocks__/    # Jest mocks
│   │   ├── fixtures/     # Test data
│   │   ├── testUtils/    # Testing utilities
│   │   └── setup.ts      # Jest setup
│   └── package.json      # Jest configuration
└── .github/workflows/     # CI/CD pipelines
```

## Backend Testing

### Technology Stack

- **pytest**: Main testing framework
- **pytest-asyncio**: Async test support
- **factory_boy**: Test data generation
- **httpx**: Async HTTP client for API tests
- **pytest-cov**: Coverage reporting

### Running Backend Tests

```bash
# All tests
make test-backend

# Unit tests only
cd backend && python -m pytest tests/unit -v

# Integration tests only
cd backend && python -m pytest tests/integration -v

# E2E tests only
cd backend && python -m pytest tests/e2e -v

# With coverage
cd backend && python -m pytest --cov=app --cov-report=html

# Specific test file
cd backend && python -m pytest tests/unit/test_user.py -v

# Specific test method
cd backend && python -m pytest tests/unit/test_user.py::TestUserModel::test_create_user -v
```

### Writing Backend Tests

#### Unit Test Example

```python
# tests/unit/models/test_user.py
import pytest
from app.models.user import User, UserRole
from tests.factories import UserFactory

class TestUserModel:
    @pytest.mark.unit
    async def test_create_user(self, db_session):
        """Test creating a user with valid data."""
        user = UserFactory.build()
        db_session.add(user)
        await db_session.commit()
        
        assert user.id is not None
        assert user.role == UserRole.STUDENT
        assert user.is_active is True
```

#### Integration Test Example

```python
# tests/integration/api/test_auth_endpoints.py
import pytest
from httpx import AsyncClient

class TestAuthEndpoints:
    @pytest.mark.integration
    @pytest.mark.auth
    async def test_login_success(self, async_client: AsyncClient, test_user):
        """Test successful login."""
        response = await async_client.post("/api/v1/auth/login", json={
            "email": "test@example.com",
            "password": "TestPassword123!"
        })
        
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
```

### Test Factories and Fixtures

#### Using Factories

```python
from tests.factories import UserFactory, ClassInstanceFactory

# Create a single user
user = UserFactory()

# Create multiple users
users = UserFactory.create_batch(5)

# Create with specific attributes
admin = UserFactory(role=UserRole.ADMIN)

# Build without saving to database
user_data = UserFactory.build()
```

#### Common Fixtures

```python
# Available fixtures from conftest.py
async def test_example(
    db_session,          # Database session
    test_user,           # Regular user
    admin_user,          # Admin user
    instructor_user,     # Instructor user
    auth_headers,        # Authorization headers
    mock_stripe,         # Mock Stripe service
    mock_redis           # Mock Redis service
):
    # Your test code here
    pass
```

### Mocking External Services

```python
# Using mock services
from tests.mocks import MockStripeService

@patch('app.services.stripe_service.stripe', MockStripeService())
async def test_payment_processing(self, db_session):
    # Test payment logic with mocked Stripe
    pass
```

## Mobile Testing

### Technology Stack

- **Jest**: Testing framework
- **React Native Testing Library**: Component testing
- **MSW (Mock Service Worker)**: API mocking
- **Detox**: E2E testing framework

### Running Mobile Tests

```bash
# All tests
cd mobile && npm test

# Unit tests only
cd mobile && npm test -- --testPathPattern=tests/unit

# Integration tests only
cd mobile && npm test -- --testPathPattern=tests/integration

# With coverage
cd mobile && npm test -- --coverage

# Watch mode
cd mobile && npm test -- --watch

# Specific test file
cd mobile && npm test useAuth.test.tsx

# E2E tests (Detox)
cd mobile && npx detox test
```

### Writing Mobile Tests

#### Hook Test Example

```typescript
// tests/unit/hooks/useAuth.test.tsx
import { renderHook, act } from '@testing-library/react-native';
import { useAuth } from '../../../src/hooks/useAuth';

describe('useAuth Hook', () => {
  it('should login successfully', async () => {
    const { result } = renderHook(() => useAuth());
    
    await act(async () => {
      await result.current.login('test@example.com', 'password');
    });
    
    expect(result.current.isAuthenticated).toBe(true);
  });
});
```

#### Component Test Example

```typescript
// tests/integration/components/ClassCard.test.tsx
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { renderWithAuth } from '../../testUtils/renderWithProviders';
import ClassCard from '../../../src/components/ClassCard';

describe('ClassCard Component', () => {
  it('should render class information', () => {
    const mockClass = { /* mock data */ };
    const { getByText } = renderWithAuth(<ClassCard classInstance={mockClass} />);
    
    expect(getByText('Pilates Fundamentals')).toBeTruthy();
  });
});
```

### Test Utilities

#### Custom Render Functions

```typescript
// Using custom render with providers
import { renderWithAuth } from '../testUtils/renderWithProviders';

// Render with authenticated user
const { getByText } = renderWithAuth(<Component />);

// Render with specific user
const { getByText } = renderWithAuth(<Component />, { 
  user: customUser 
});

// Render without authentication
const { getByText } = renderWithoutAuth(<Component />);
```

#### Mock Server Setup

```typescript
// tests/testUtils/mockServer.ts
import { setupMockServer } from '../testUtils/mockServer';

// In your test file
setupMockServer(); // Automatically sets up MSW

// Custom handlers for specific tests
mockServerHandlers.networkError('/api/classes');
```

### Mocking React Native Dependencies

```typescript
// tests/setup.ts - already configured
jest.mock('expo-secure-store');
jest.mock('@react-native-async-storage/async-storage');
jest.mock('@stripe/stripe-react-native');
// ... and many more
```

## End-to-End Testing

### Detox Setup (Mobile E2E)

```bash
# Install Detox CLI
npm install -g detox-cli

# iOS setup
cd mobile && npx detox build --configuration ios.sim.debug

# Android setup
cd mobile && npx detox build --configuration android.emu.debug

# Run tests
npx detox test --configuration ios.sim.debug
```

### Writing E2E Tests

```typescript
// mobile/tests/e2e/auth.e2e.js
describe('Authentication Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  it('should login successfully', async () => {
    await element(by.id('email-input')).typeText('test@example.com');
    await element(by.id('password-input')).typeText('password');
    await element(by.id('login-button')).tap();
    
    await expect(element(by.id('home-screen'))).toBeVisible();
  });
});
```

### Backend E2E Tests

```python
# backend/tests/e2e/test_complete_booking_flow.py
@pytest.mark.e2e
async def test_complete_booking_journey(self, async_client: AsyncClient):
    """Test complete user journey from registration to booking."""
    
    # 1. Register user
    register_response = await async_client.post("/api/v1/auth/register", json={
        "email": "newuser@example.com",
        "password": "SecurePassword123!",
        "first_name": "Test",
        "last_name": "User"
    })
    assert register_response.status_code == 201
    
    # 2. Login
    login_response = await async_client.post("/api/v1/auth/login", json={
        "email": "newuser@example.com",
        "password": "SecurePassword123!"
    })
    assert login_response.status_code == 200
    
    # 3. Purchase package
    # 4. Book class
    # 5. Verify booking
```

## CI/CD Integration

### GitHub Actions Workflows

Our CI/CD pipeline includes three main workflows:

1. **Backend Tests** (`.github/workflows/backend-tests.yml`)
2. **Mobile Tests** (`.github/workflows/mobile-tests.yml`)
3. **E2E Tests** (`.github/workflows/e2e-tests.yml`)

### Coverage Reporting

Coverage is automatically uploaded to Codecov and enforced at:
- Backend: 80% minimum coverage
- Mobile: 75% minimum coverage

### Branch Protection Rules

Tests must pass before merging to main:
- All status checks required
- Up-to-date branches required
- No force pushes allowed

## Coverage Requirements

### Backend Coverage Targets

- **Unit Tests**: 90% coverage minimum
- **Integration Tests**: 80% coverage minimum
- **Critical Paths**: 100% coverage required
  - Authentication flow
  - Payment processing
  - Booking creation/cancellation

### Mobile Coverage Targets

- **Unit Tests**: 85% coverage minimum
- **Component Tests**: 75% coverage minimum
- **Critical User Flows**: 100% coverage required
  - Login/logout
  - Class booking
  - Payment processing

### Coverage Commands

```bash
# Backend coverage
cd backend && python -m pytest --cov=app --cov-report=html
open htmlcov/index.html

# Mobile coverage
cd mobile && npm test -- --coverage
open coverage/lcov-report/index.html
```

## Best Practices

### General Testing Principles

1. **AAA Pattern**: Arrange, Act, Assert
2. **Test Isolation**: Each test should be independent
3. **Descriptive Names**: Test names should describe the scenario
4. **Single Responsibility**: One assertion per test (when possible)
5. **Fast Execution**: Unit tests should run quickly

### Backend Best Practices

```python
# ✅ Good test structure
class TestUserService:
    async def test_create_user_with_valid_data_returns_user(self):
        # Arrange
        user_data = {"email": "test@example.com", "password": "secure123"}
        
        # Act
        user = await user_service.create_user(**user_data)
        
        # Assert
        assert user.email == "test@example.com"
        assert user.id is not None

# ❌ Avoid this
async def test_user(self):  # Non-descriptive name
    user = UserFactory()
    user.save()
    assert user  # Vague assertion
```

### Mobile Best Practices

```typescript
// ✅ Good component test
describe('LoginButton Component', () => {
  it('should disable button while login is in progress', () => {
    const { getByRole } = render(<LoginButton isLoading={true} />);
    const button = getByRole('button');
    
    expect(button).toBeDisabled();
  });
});

// ❌ Avoid this
test('button test', () => {  // Non-descriptive
  // Testing implementation details instead of behavior
  expect(component.state.loading).toBe(true);
});
```

### Test Data Management

```python
# ✅ Use factories for test data
user = UserFactory(email="specific@example.com")

# ❌ Avoid hard-coded test data
user = User(
    id=1,
    email="test@example.com",
    password="hash123",
    # ... many fields
)
```

### Mocking Guidelines

```typescript
// ✅ Mock external dependencies
jest.mock('../../../src/api/client');

// ✅ Mock at the boundary
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;
mockApiClient.get.mockResolvedValue({ data: mockUser });

// ❌ Don't mock what you're testing
jest.mock('../../../src/hooks/useAuth'); // If testing useAuth
```

### Async Testing

```python
# ✅ Proper async test
@pytest.mark.asyncio
async def test_async_operation(self):
    result = await async_function()
    assert result is not None

# ✅ Proper React async test
await waitFor(() => {
  expect(getByText('Success')).toBeInTheDocument();
});
```

## Test Markers and Categories

### Backend Markers

```python
# Available pytest markers
@pytest.mark.unit          # Unit tests
@pytest.mark.integration   # Integration tests
@pytest.mark.e2e          # End-to-end tests
@pytest.mark.auth          # Authentication tests
@pytest.mark.booking       # Booking-related tests
@pytest.mark.payment       # Payment tests
@pytest.mark.slow          # Slower running tests
```

### Running Specific Test Categories

```bash
# Run only unit tests
cd backend && python -m pytest -m unit

# Run only auth tests
cd backend && python -m pytest -m auth

# Exclude slow tests
cd backend && python -m pytest -m "not slow"

# Multiple markers
cd backend && python -m pytest -m "auth and unit"
```

## Troubleshooting

### Common Backend Issues

#### Database Connection Issues

```bash
# Check PostgreSQL is running
docker-compose ps postgres

# Reset test database
docker-compose exec postgres psql -U pilates_user -d pilates_db -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"

# Run migrations
cd backend && python -m alembic upgrade head
```

#### Async Test Issues

```python
# ✅ Proper async fixture usage
@pytest.mark.asyncio
async def test_with_db(self, db_session):  # Use async fixtures
    user = UserFactory()
    db_session.add(user)
    await db_session.commit()  # Don't forget await

# ❌ Common mistake
def test_with_db(self, db_session):  # Missing async
    # This won't work with async database operations
```

### Common Mobile Issues

#### React Native Testing Library Issues

```typescript
// ✅ Wait for async operations
await waitFor(() => {
  expect(getByText('Loaded')).toBeTruthy();
});

// ❌ Don't test immediately
expect(getByText('Loaded')).toBeTruthy(); // Might fail if loading
```

#### Mock Issues

```typescript
// ✅ Clear mocks between tests
beforeEach(() => {
  jest.clearAllMocks();
});

// ✅ Reset MSW handlers
afterEach(() => {
  mockServer.resetHandlers();
});
```

### Test Performance Issues

#### Slow Backend Tests

```python
# Use test database instead of real one
TEST_DATABASE_URL = "sqlite+aiosqlite:///./test.db"

# Use factories instead of real API calls
user = UserFactory.build()  # Don't hit database
```

#### Slow Mobile Tests

```typescript
// Use fake timers for time-dependent tests
jest.useFakeTimers();

// Mock heavy dependencies
jest.mock('react-native-reanimated');
```

### CI/CD Issues

#### GitHub Actions Failures

```bash
# Check logs in GitHub Actions UI
# Common fixes:

# Update Node.js version
uses: actions/setup-node@v4
with:
  node-version: '20'

# Fix Python dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

#### Coverage Failures

```bash
# Check what's not covered
cd backend && python -m pytest --cov=app --cov-report=term-missing

# Exclude files from coverage
# Add to .coveragerc or pytest.ini
omit = 
    */tests/*
    */migrations/*
```

### Debug Mode

#### Backend Debug Mode

```bash
# Run with debugging
cd backend && python -m pytest --pdb tests/unit/test_user.py

# Print to see values
print(f"User: {user}")  # Add to test for debugging
```

#### Mobile Debug Mode

```typescript
// Use screen.debug() to see component tree
const { getByText, debug } = render(<Component />);
debug(); // Prints component tree

// Log values
console.log('Component props:', props);
```

## Writing New Tests

### Checklist for New Tests

- [ ] **Descriptive test names** that explain the scenario
- [ ] **Proper test categorization** (unit/integration/e2e)
- [ ] **Use appropriate fixtures** and factories
- [ ] **Mock external dependencies** at boundaries
- [ ] **Test both success and failure paths**
- [ ] **Include edge cases** and error scenarios
- [ ] **Maintain test isolation** (no shared state)
- [ ] **Add accessibility tests** for UI components
- [ ] **Follow naming conventions** for test IDs and markers

### Test Templates

#### Backend Unit Test Template

```python
"""
Unit tests for [Module Name].
Tests [brief description of what's being tested].
"""

import pytest
from app.models.[model] import [Model]
from tests.factories import [Factory]

class Test[ClassName]:
    """Test [class/function] functionality."""

    @pytest.mark.unit
    async def test_[action]_with_[condition]_[expected_result](
        self, 
        db_session: AsyncSession
    ):
        """Test that [action] with [condition] returns [expected_result]."""
        # Arrange
        test_data = [Factory]()
        
        # Act
        result = await [function_under_test](test_data)
        
        # Assert
        assert result.[expected_property] == expected_value
```

#### Mobile Component Test Template

```typescript
/**
 * Unit/Integration tests for [ComponentName] component.
 * Tests [brief description of component functionality].
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithAuth } from '../../testUtils/renderWithProviders';
import [ComponentName] from '../../../src/components/[ComponentName]';

describe('[ComponentName] Component', () => {
  const mockProps = {
    // Default props
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render [expected content] correctly', () => {
      const { getByText } = renderWithAuth(
        <[ComponentName] {...mockProps} />
      );

      expect(getByText('[expected text]')).toBeTruthy();
    });
  });

  describe('Interaction', () => {
    it('should [expected behavior] when [action] is performed', async () => {
      const mockHandler = jest.fn();
      const { getByRole } = renderWithAuth(
        <[ComponentName] {...mockProps} onAction={mockHandler} />
      );

      fireEvent.press(getByRole('button'));

      await waitFor(() => {
        expect(mockHandler).toHaveBeenCalledWith(expectedArgs);
      });
    });
  });
});
```

## Continuous Improvement

### Test Metrics to Track

- **Test Coverage**: Aim for high coverage of critical paths
- **Test Performance**: Keep unit tests under 100ms each
- **Test Reliability**: Minimize flaky tests
- **Test Maintenance**: Regular cleanup of obsolete tests

### Regular Tasks

- **Weekly**: Review failing tests and flaky test reports
- **Monthly**: Analyze test coverage reports and identify gaps
- **Quarterly**: Update testing dependencies and review test strategy
- **Before releases**: Run full E2E test suite and performance tests

---

## Quick Reference

### Command Cheat Sheet

```bash
# Backend
make test-backend              # All backend tests
make test-backend-unit         # Unit tests only
make test-backend-integration  # Integration tests only

# Mobile
npm test                       # All mobile tests
npm test -- --watch          # Watch mode
npm test -- --coverage       # With coverage
npm run test:e2e              # E2E tests (Detox)

# Coverage
make coverage                 # Generate coverage reports
open coverage/index.html      # View coverage report

# CI/CD
git push origin feature/branch # Triggers test pipeline
```

### Useful Pytest Options

```bash
-v                    # Verbose output
--tb=short           # Short traceback format
-x                   # Stop on first failure
--lf                 # Run only last failed tests
--cov=app           # Generate coverage for app module
-m "unit"           # Run only unit tests
-k "test_user"      # Run tests matching pattern
--pdb               # Drop into debugger on failure
```

### Jest Test Options

```bash
--watch             # Watch for changes
--coverage         # Generate coverage report
--verbose          # Verbose output
--silent           # Silent output
--bail             # Stop on first test failure
--updateSnapshot   # Update snapshots
--testNamePattern="auth"  # Run tests matching pattern
```

Remember: **Good tests are your safety net for confident code changes and deployments.**