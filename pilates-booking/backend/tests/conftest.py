"""
Global test configuration and fixtures for the Pilates Booking System.
Provides shared fixtures, database setup, and testing utilities.
"""

import asyncio
from datetime import datetime, timedelta
from typing import AsyncGenerator, Generator
from unittest.mock import MagicMock

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Override settings for testing before any app imports
import os
os.environ["DATABASE_URL"] = "sqlite+aiosqlite:///:memory:"
os.environ["LOGIN_RATE_LIMIT_PER_MINUTE"] = "1000"
os.environ["REDIS_URL"] = "redis://localhost:6379/1"  # Use test Redis DB

from app.core.config import settings
from app.core.database import Base, get_db
from app.core.security import create_access_token, get_password_hash
from app.main import app
from app.models.user import User, UserRole

# Test database configuration - use in-memory SQLite for isolation
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Ensure settings are properly overridden
settings.LOGIN_RATE_LIMIT_PER_MINUTE = 1000

# Create test engine with in-memory SQLite
test_engine = create_async_engine(
    TEST_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
    echo=False,  # Set to True for SQL debugging
)

TestSessionLocal = sessionmaker(
    bind=test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
    autocommit=False,
    autoflush=False,
)


async def override_get_db() -> AsyncGenerator[AsyncSession, None]:
    """Override database dependency for testing."""
    async with TestSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


# Override the database dependency
app.dependency_overrides[get_db] = override_get_db


@pytest_asyncio.fixture(scope="session")
async def engine():
    """Create test database engine."""
    return test_engine


@pytest_asyncio.fixture(scope="session")
async def setup_database():
    """Set up test database tables."""
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(setup_database) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async with TestSessionLocal() as session:
        try:
            yield session
            await session.rollback()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


@pytest.fixture
def client() -> Generator[TestClient, None, None]:
    """Create a test client."""
    with TestClient(app) as test_client:
        yield test_client


@pytest_asyncio.fixture
async def async_client() -> AsyncGenerator[AsyncClient, None]:
    """Create an async test client."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


# User fixtures
@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession) -> User:
    """Create a test user."""
    user = User(
        email="test@example.com",
        hashed_password=get_password_hash("TestPassword123!"),
        first_name="Test",
        last_name="User",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_user(db_session: AsyncSession) -> User:
    """Create an admin user."""
    user = User(
        email="admin@example.com",
        hashed_password=get_password_hash("AdminPassword123!"),
        first_name="Admin",
        last_name="User",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def instructor_user(db_session: AsyncSession) -> User:
    """Create an instructor user."""
    user = User(
        email="instructor@example.com",
        hashed_password=get_password_hash("InstructorPassword123!"),
        first_name="Jane",
        last_name="Instructor",
        role=UserRole.INSTRUCTOR,
        is_active=True,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def inactive_user(db_session: AsyncSession) -> User:
    """Create an inactive user."""
    user = User(
        email="inactive@example.com",
        hashed_password=get_password_hash("InactivePassword123!"),
        first_name="Inactive",
        last_name="User",
        role=UserRole.STUDENT,
        is_active=False,
        is_verified=True,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def unverified_user(db_session: AsyncSession) -> User:
    """Create an unverified user."""
    user = User(
        email="unverified@example.com",
        hashed_password=get_password_hash("UnverifiedPassword123!"),
        first_name="Unverified",
        last_name="User",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=False,
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


# Authentication fixtures
@pytest_asyncio.fixture
async def user_token(test_user: User) -> str:
    """Create a JWT token for a test user."""
    return create_access_token(subject=test_user.id)


@pytest_asyncio.fixture
async def admin_token(admin_user: User) -> str:
    """Create a JWT token for an admin user."""
    return create_access_token(subject=admin_user.id)


@pytest_asyncio.fixture
async def instructor_token(instructor_user: User) -> str:
    """Create a JWT token for an instructor user."""
    return create_access_token(subject=instructor_user.id)


@pytest.fixture
def expired_token() -> str:
    """Create an expired JWT token."""
    return create_access_token(
        subject=999,
        expires_delta=timedelta(seconds=-1)  # Already expired
    )


@pytest_asyncio.fixture
async def auth_headers(user_token: str) -> dict:
    """Create authorization headers with user token."""
    return {"Authorization": f"Bearer {user_token}"}


@pytest_asyncio.fixture
async def admin_headers(admin_token: str) -> dict:
    """Create authorization headers with admin token."""
    return {"Authorization": f"Bearer {admin_token}"}


@pytest_asyncio.fixture
async def instructor_headers(instructor_token: str) -> dict:
    """Create authorization headers with instructor token."""
    return {"Authorization": f"Bearer {instructor_token}"}


# Mock fixtures
@pytest.fixture
def mock_stripe():
    """Mock Stripe service."""
    mock = MagicMock()
    mock.PaymentIntent.create.return_value = MagicMock(
        id="pi_test_payment_intent",
        client_secret="pi_test_payment_intent_secret_test",
        status="requires_payment_method",
    )
    mock.Customer.create.return_value = MagicMock(
        id="cus_test_customer",
        email="test@example.com",
    )
    return mock


@pytest.fixture
def mock_redis():
    """Mock Redis client."""
    mock = MagicMock()
    mock.get.return_value = None
    mock.set.return_value = True
    mock.delete.return_value = True
    mock.incr.return_value = 1
    mock.expire.return_value = True
    return mock


@pytest.fixture
def mock_email_service():
    """Mock email service."""
    mock = MagicMock()
    mock.send_verification_email.return_value = True
    mock.send_password_reset_email.return_value = True
    mock.send_booking_confirmation.return_value = True
    mock.send_booking_cancellation.return_value = True
    return mock


# Date and time fixtures
@pytest.fixture
def now() -> datetime:
    """Current datetime for testing."""
    return datetime.utcnow()


@pytest.fixture
def future_date() -> datetime:
    """Future datetime for testing."""
    return datetime.utcnow() + timedelta(days=7)


@pytest.fixture
def past_date() -> datetime:
    """Past datetime for testing."""
    return datetime.utcnow() - timedelta(days=7)


# HTTP request mock fixture
@pytest.fixture
def mock_request():
    """Mock FastAPI request object."""
    mock = MagicMock()
    mock.client.host = "127.0.0.1"
    mock.headers.get.return_value = "test-user-agent"
    mock.state.request_id = "test-request-id"
    return mock


# Event loop fixture for async tests
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


# Pytest configuration
def pytest_configure(config):
    """Configure pytest with custom markers."""
    config.addinivalue_line("markers", "unit: mark test as a unit test")
    config.addinivalue_line("markers", "integration: mark test as an integration test")
    config.addinivalue_line("markers", "e2e: mark test as an end-to-end test")
    config.addinivalue_line("markers", "slow: mark test as slow running")
    config.addinivalue_line("markers", "auth: mark test as authentication related")
    config.addinivalue_line("markers", "booking: mark test as booking related")
    config.addinivalue_line("markers", "payment: mark test as payment related")