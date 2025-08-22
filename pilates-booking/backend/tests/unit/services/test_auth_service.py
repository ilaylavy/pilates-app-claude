"""
Unit tests for AuthService.
Tests authentication logic, token management, and security features.
"""

import pytest
import pytest_asyncio
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.auth_service import AuthService
from app.models.user import User, UserRole
from app.models.refresh_token import RefreshToken
from app.core.security import verify_password, get_password_hash
from tests.factories import UserFactory, InactiveUserFactory, UnverifiedUserFactory
from tests.mocks import MockEmailService, MockRedisService


class TestAuthService:
    """Test AuthService functionality."""

    @pytest_asyncio.fixture
    async def auth_service(self, db_session: AsyncSession):
        """Create AuthService instance for testing."""
        return AuthService(db_session)

    @pytest_asyncio.fixture
    async def mock_email_service(self):
        """Create mock email service."""
        return MockEmailService()

    @pytest_asyncio.fixture 
    async def mock_redis(self):
        """Create mock Redis service."""
        return MockRedisService()

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_authenticate_user_success(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test successful user authentication."""
        password = "TestPassword123!"
        user = UserFactory(
            email="test@example.com",
            hashed_password=get_password_hash(password),
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        await db_session.commit()
        
        authenticated_user = await auth_service.authenticate_user(
            "test@example.com", password
        )
        
        assert authenticated_user is not None
        assert authenticated_user.id == user.id
        assert authenticated_user.email == "test@example.com"

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_authenticate_user_wrong_password(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test authentication with wrong password."""
        user = UserFactory(
            email="test@example.com",
            hashed_password=get_password_hash("CorrectPassword123!"),
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        await db_session.commit()
        
        authenticated_user = await auth_service.authenticate_user(
            "test@example.com", "WrongPassword123!"
        )
        
        assert authenticated_user is None

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_authenticate_user_nonexistent(
        self, 
        auth_service: AuthService
    ):
        """Test authentication with non-existent user."""
        authenticated_user = await auth_service.authenticate_user(
            "nonexistent@example.com", "password"
        )
        
        assert authenticated_user is None

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_authenticate_inactive_user(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test authentication fails for inactive user."""
        password = "TestPassword123!"
        user = InactiveUserFactory(
            email="inactive@example.com",
            hashed_password=get_password_hash(password)
        )
        db_session.add(user)
        await db_session.commit()
        
        authenticated_user = await auth_service.authenticate_user(
            "inactive@example.com", password
        )
        
        assert authenticated_user is None

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_authenticate_unverified_user(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test authentication fails for unverified user."""
        password = "TestPassword123!"
        user = UnverifiedUserFactory(
            email="unverified@example.com",
            hashed_password=get_password_hash(password)
        )
        db_session.add(user)
        await db_session.commit()
        
        authenticated_user = await auth_service.authenticate_user(
            "unverified@example.com", password
        )
        
        assert authenticated_user is None

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_create_user_tokens(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test creating user tokens with device tracking."""
        user = UserFactory()
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        device_info = {
            "device_id": "test-device-123",
            "device_name": "Test Device",
            "device_type": "mobile",
            "ip_address": "192.168.1.100",
            "user_agent": "TestApp/1.0"
        }
        
        tokens = await auth_service.create_user_tokens(user, device_info)
        
        assert "access_token" in tokens
        assert "refresh_token" in tokens
        assert tokens["token_type"] == "bearer"
        assert tokens["expires_in"] > 0

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_refresh_tokens(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test refreshing user tokens."""
        user = UserFactory()
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # Create initial tokens
        device_info = {
            "device_id": "test-device-123",
            "device_name": "Test Device",
            "device_type": "mobile",
            "ip_address": "192.168.1.100",
            "user_agent": "TestApp/1.0"
        }
        
        initial_tokens = await auth_service.create_user_tokens(user, device_info)
        
        # Refresh tokens
        new_tokens = await auth_service.refresh_user_tokens(
            initial_tokens["refresh_token"], device_info
        )
        
        assert new_tokens is not None
        assert "access_token" in new_tokens
        assert "refresh_token" in new_tokens
        assert new_tokens["access_token"] != initial_tokens["access_token"]
        assert new_tokens["refresh_token"] != initial_tokens["refresh_token"]

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_refresh_invalid_token(
        self, 
        auth_service: AuthService
    ):
        """Test refreshing with invalid token."""
        device_info = {"device_id": "test-device-123"}
        
        result = await auth_service.refresh_user_tokens(
            "invalid_refresh_token", device_info
        )
        
        assert result is None

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_logout_user(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test user logout (deactivating refresh tokens)."""
        user = UserFactory()
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # Create tokens
        device_info = {"device_id": "test-device-123"}
        tokens = await auth_service.create_user_tokens(user, device_info)
        
        # Logout
        success = await auth_service.logout_user(tokens["refresh_token"])
        
        assert success is True
        
        # Token should no longer work for refresh
        new_tokens = await auth_service.refresh_user_tokens(
            tokens["refresh_token"], device_info
        )
        assert new_tokens is None

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_logout_all_devices(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test logging out from all devices."""
        user = UserFactory()
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # Create multiple device tokens
        devices = [
            {"device_id": "device-1", "device_name": "Phone"},
            {"device_id": "device-2", "device_name": "Tablet"},
            {"device_id": "device-3", "device_name": "Laptop"},
        ]
        
        tokens_list = []
        for device in devices:
            tokens = await auth_service.create_user_tokens(user, device)
            tokens_list.append(tokens)
        
        # Logout from all devices
        count = await auth_service.logout_all_devices(user.id)
        assert count == 3
        
        # All tokens should be invalid
        for tokens in tokens_list:
            result = await auth_service.refresh_user_tokens(
                tokens["refresh_token"], {"device_id": "any"}
            )
            assert result is None

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_register_user(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession,
        mock_email_service: MockEmailService
    ):
        """Test user registration."""
        with patch('app.services.auth_service.email_service', mock_email_service):
            user_data = {
                "email": "newuser@example.com",
                "password": "SecurePassword123!",
                "first_name": "New",
                "last_name": "User",
                "phone_number": "+1234567890"
            }
            
            user = await auth_service.register_user(**user_data)
            
            assert user is not None
            assert user.email == "newuser@example.com"
            assert user.first_name == "New"
            assert user.last_name == "User"
            assert user.phone_number == "+1234567890"
            assert user.role == UserRole.STUDENT
            assert user.is_active is True
            assert user.is_verified is False  # Should require verification
            
            # Verification email should be sent
            assert mock_email_service.get_emails_count() == 1
            last_email = mock_email_service.get_last_email()
            assert last_email["to"] == "newuser@example.com"
            assert "verify" in last_email["subject"].lower()

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_register_duplicate_email(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test registration with duplicate email fails."""
        existing_user = UserFactory(email="existing@example.com")
        db_session.add(existing_user)
        await db_session.commit()
        
        user_data = {
            "email": "existing@example.com",
            "password": "SecurePassword123!",
            "first_name": "New",
            "last_name": "User"
        }
        
        with pytest.raises(ValueError, match="Email already registered"):
            await auth_service.register_user(**user_data)

    @pytest.mark.unit
    @pytest.mark.auth
    @patch('app.services.auth_service.redis_client')
    async def test_rate_limiting(
        self, 
        mock_redis,
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test rate limiting for authentication attempts."""
        mock_redis_service = MockRedisService()
        mock_redis.return_value = mock_redis_service
        
        # Simulate failed attempts
        ip_address = "192.168.1.100"
        
        # First few attempts should be allowed
        for i in range(3):
            result = await auth_service.check_rate_limit(ip_address)
            assert result is True
            await auth_service.record_failed_attempt(ip_address)
        
        # After threshold, should be rate limited
        mock_redis_service.set(f"failed_attempts:{ip_address}", "6", ex=900)
        result = await auth_service.check_rate_limit(ip_address)
        assert result is False

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_password_strength_validation(self, auth_service: AuthService):
        """Test password strength validation."""
        # Weak password
        weak_result = auth_service.validate_password_strength("123")
        assert not weak_result["is_valid"]
        assert weak_result["strength"] == "weak"
        
        # Medium password
        medium_result = auth_service.validate_password_strength("Password123")
        assert medium_result["is_valid"]
        assert medium_result["strength"] == "medium"
        
        # Strong password
        strong_result = auth_service.validate_password_strength("SecurePassword123!")
        assert strong_result["is_valid"]
        assert strong_result["strength"] == "strong"

    @pytest.mark.unit
    @pytest.mark.auth
    async def test_verify_email_token(
        self, 
        auth_service: AuthService, 
        db_session: AsyncSession
    ):
        """Test email verification with token."""
        user = UnverifiedUserFactory()
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        # Generate verification token
        verification_token = auth_service.generate_verification_token(user.email)
        
        # Verify email
        verified_user = await auth_service.verify_email_token(verification_token)
        
        assert verified_user is not None
        assert verified_user.is_verified is True
        assert verified_user.id == user.id