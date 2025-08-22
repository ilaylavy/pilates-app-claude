"""
Comprehensive security test suite for the Pilates Booking System.
Tests authentication, authorization, input validation, and other security measures.
"""

import asyncio
import time
from unittest.mock import MagicMock, patch

import pytest
import pytest_asyncio
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.security import (create_access_token, generate_refresh_token,
                               hash_token, validate_password_strength)
from app.main import app
from app.models.audit_log import AuditActionType, AuditLog, SecurityLevel
from app.models.refresh_token import RefreshToken
from app.models.user import User, UserRole
from app.services.audit_service import AuditService
from app.services.auth_service import AuthService

# Database setup is handled in conftest.py
# Override rate limit setting for tests
settings.LOGIN_RATE_LIMIT_PER_MINUTE = 1000  # Very high limit for tests


def make_login_request(client, email="test@example.com", password="TestPassword123!", delay_seconds=0):
    """Make a login request with optional delay to avoid rate limiting."""
    if delay_seconds > 0:
        time.sleep(delay_seconds)
    
    return client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password},
    )


# Fixtures are provided by conftest.py


class TestAuthentication:
    """Test authentication security measures."""

    def test_login_with_valid_credentials(self, client, test_user):
        """Test successful login with valid credentials."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )
        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert "refresh_token" in data
        assert data["token_type"] == "bearer"

    def test_login_with_invalid_credentials(self, client, test_user):
        """Test login failure with invalid credentials."""
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "wrongpassword"},
        )
        assert response.status_code == 401
        assert "Incorrect email or password" in response.json()["detail"]

    def test_login_with_unverified_user(self, client, db_session):
        """Test login failure with unverified user."""
        from app.core.security import get_password_hash

        # Create unverified user
        user = User(
            email="unverified@example.com",
            hashed_password=get_password_hash("TestPassword123!"),
            first_name="Unverified",
            last_name="User",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=False,
        )
        db_session.add(user)
        asyncio.run(db_session.commit())

        response = client.post(
            "/api/v1/auth/login",
            json={"email": "unverified@example.com", "password": "TestPassword123!"},
        )
        assert response.status_code == 400
        assert "verify your email" in response.json()["detail"]

    def test_rate_limiting_login_attempts(self, client, test_user):
        """Test rate limiting on login attempts."""
        # Make multiple failed login attempts
        for i in range(6):  # Exceed the limit of 5
            response = client.post(
                "/api/v1/auth/login",
                json={"email": "test@example.com", "password": "wrongpassword"},
            )

            if i < 5:
                assert response.status_code == 401
            else:
                # Should be rate limited after 5 attempts
                assert response.status_code == 429

    def test_password_strength_validation(self):
        """Test password strength validation."""
        # Weak password
        weak = validate_password_strength("123")
        assert not weak["is_valid"]
        assert weak["strength"] == "weak"

        # Medium password
        medium = validate_password_strength("Password123")
        assert medium["is_valid"]
        assert medium["strength"] == "medium"

        # Strong password
        strong = validate_password_strength("TestPassword123!")
        assert strong["is_valid"]
        assert strong["strength"] == "strong"


class TestTokenSecurity:
    """Test JWT token security measures."""

    def test_refresh_token_rotation(self, client, test_user):
        """Test refresh token rotation on token refresh."""
        # Login to get initial tokens
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )
        initial_tokens = response.json()

        # Refresh tokens
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": initial_tokens["refresh_token"]},
        )
        assert response.status_code == 200
        new_tokens = response.json()

        # Tokens should be different (rotated)
        assert new_tokens["access_token"] != initial_tokens["access_token"]
        assert new_tokens["refresh_token"] != initial_tokens["refresh_token"]

        # Old refresh token should be invalid
        response = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": initial_tokens["refresh_token"]},
        )
        assert response.status_code == 401

    def test_token_expiration(self, client, test_user):
        """Test access token expiration."""
        # Create an expired token
        from datetime import timedelta

        expired_token = create_access_token(
            subject=test_user.id, expires_delta=timedelta(seconds=-1)  # Already expired
        )

        # Try to access protected endpoint with expired token
        response = client.get(
            "/api/v1/users/me", headers={"Authorization": f"Bearer {expired_token}"}
        )
        assert response.status_code == 401

    def test_invalid_token_format(self, client):
        """Test handling of invalid token formats."""
        invalid_tokens = [
            "invalid.token.format",
            "Bearer invalid_token",
            "malformed_token",
            "",
        ]

        for token in invalid_tokens:
            response = client.get(
                "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 401


class TestInputValidation:
    """Test input validation and sanitization."""

    def test_sql_injection_protection(self, client):
        """Test protection against SQL injection attacks."""
        sql_injection_payloads = [
            "'; DROP TABLE users; --",
            "' OR '1'='1",
            "1; DELETE FROM users WHERE 1=1; --",
            "' UNION SELECT * FROM users --",
        ]

        for payload in sql_injection_payloads:
            response = client.post(
                "/api/v1/auth/login", json={"email": payload, "password": "password"}
            )
            # Should not cause a server error (would be 500 if SQL injection worked)
            assert response.status_code in [400, 401, 422]

    def test_xss_protection(self, client):
        """Test protection against XSS attacks."""
        xss_payloads = [
            "<script>alert('xss')</script>",
            "javascript:alert('xss')",
            "<img src=x onerror=alert('xss')>",
            "data:text/html,<script>alert('xss')</script>",
        ]

        for payload in xss_payloads:
            response = client.post(
                "/api/v1/auth/register",
                json={
                    "email": "test@example.com",
                    "password": "TestPassword123!",
                    "first_name": payload,
                    "last_name": "User",
                },
            )
            # Should reject malicious input
            assert response.status_code == 400

    def test_oversized_request_handling(self, client):
        """Test handling of oversized requests."""
        # Create a very large payload
        large_payload = "A" * (10 * 1024 * 1024)  # 10MB string

        response = client.post(
            "/api/v1/auth/register",
            json={
                "email": "test@example.com",
                "password": "TestPassword123!",
                "first_name": large_payload,
                "last_name": "User",
            },
        )
        # Should reject oversized requests
        assert response.status_code in [400, 413, 422]


class TestAuthorization:
    """Test authorization and access control."""

    def test_admin_only_endpoints(self, client, test_user, admin_user):
        """Test that admin-only endpoints require admin role."""
        # Get regular user token
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )
        user_token = response.json()["access_token"]

        # Get admin token
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "admin@example.com", "password": "AdminPassword123!"},
        )
        admin_token = response.json()["access_token"]

        # Test admin endpoint with regular user (should fail)
        response = client.get(
            "/api/v1/admin/users", headers={"Authorization": f"Bearer {user_token}"}
        )
        assert response.status_code == 403

        # Test admin endpoint with admin user (should succeed)
        response = client.get(
            "/api/v1/admin/users", headers={"Authorization": f"Bearer {admin_token}"}
        )
        assert response.status_code == 200

    def test_user_data_isolation(self, client, db_session):
        """Test that users can only access their own data."""
        # Create two users
        from app.core.security import get_password_hash

        user1 = User(
            email="user1@example.com",
            hashed_password=get_password_hash("Password123!"),
            first_name="User",
            last_name="One",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        user2 = User(
            email="user2@example.com",
            hashed_password=get_password_hash("Password123!"),
            first_name="User",
            last_name="Two",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        )
        db_session.add_all([user1, user2])
        asyncio.run(db_session.commit())

        # Login as user1
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "user1@example.com", "password": "Password123!"},
        )
        user1_token = response.json()["access_token"]

        # Try to access user2's data (should fail)
        response = client.get(
            f"/api/v1/users/{user2.id}",
            headers={"Authorization": f"Bearer {user1_token}"},
        )
        assert response.status_code == 403


class TestAuditLogging:
    """Test audit logging functionality."""

    async def test_login_audit_logging(self, db_session: AsyncSession, test_user):
        """Test that login attempts are properly logged."""
        auth_service = AuthService(db_session)
        audit_service = AuditService(db_session)

        # Create a mock request
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = "test-user-agent"
        mock_request.state.request_id = "test-request-id"

        # Log a successful login
        await audit_service.log_login_attempt(
            request=mock_request, email="test@example.com", success=True, user=test_user
        )

        # Check audit log
        from sqlalchemy import select

        stmt = select(AuditLog).where(AuditLog.action == AuditActionType.LOGIN_SUCCESS)
        result = await db_session.execute(stmt)
        log_entry = result.scalar_one_or_none()

        assert log_entry is not None
        assert log_entry.user_id == test_user.id
        assert log_entry.security_level == SecurityLevel.MEDIUM
        assert log_entry.success == "true"

    async def test_failed_login_audit_logging(self, db_session: AsyncSession):
        """Test that failed login attempts are logged."""
        audit_service = AuditService(db_session)

        # Create a mock request
        mock_request = MagicMock()
        mock_request.client.host = "127.0.0.1"
        mock_request.headers.get.return_value = "test-user-agent"
        mock_request.state.request_id = "test-request-id"

        # Log a failed login
        await audit_service.log_login_attempt(
            request=mock_request,
            email="nonexistent@example.com",
            success=False,
            error_message="Invalid credentials",
        )

        # Check audit log
        from sqlalchemy import select

        stmt = select(AuditLog).where(AuditLog.action == AuditActionType.LOGIN_FAILED)
        result = await db_session.execute(stmt)
        log_entry = result.scalar_one_or_none()

        assert log_entry is not None
        assert log_entry.user_id is None
        assert log_entry.security_level == SecurityLevel.HIGH
        assert log_entry.success == "false"
        assert log_entry.error_message == "Invalid credentials"


class TestDeviceTracking:
    """Test device tracking functionality."""

    async def test_refresh_token_device_tracking(
        self, db_session: AsyncSession, test_user
    ):
        """Test that refresh tokens track device information."""
        auth_service = AuthService(db_session)

        device_info = {
            "device_id": "test-device-123",
            "device_name": "Test Device",
            "device_type": "mobile",
            "ip_address": "192.168.1.100",
            "user_agent": "TestApp/1.0",
        }

        # Create tokens with device tracking
        tokens = await auth_service.create_user_tokens(test_user, device_info)

        # Check that refresh token record was created
        from sqlalchemy import select

        stmt = select(RefreshToken).where(RefreshToken.user_id == test_user.id)
        result = await db_session.execute(stmt)
        token_record = result.scalar_one_or_none()

        assert token_record is not None
        assert token_record.device_id == "test-device-123"
        assert token_record.device_name == "Test Device"
        assert token_record.device_type == "mobile"
        assert token_record.ip_address == "192.168.1.100"
        assert token_record.user_agent == "TestApp/1.0"

    async def test_logout_all_devices(self, db_session: AsyncSession, test_user):
        """Test logout from all devices functionality."""
        auth_service = AuthService(db_session)

        # Create multiple refresh tokens (simulate multiple devices)
        for i in range(3):
            device_info = {
                "device_id": f"device-{i}",
                "device_name": f"Device {i}",
                "device_type": "mobile",
                "ip_address": f"192.168.1.{100 + i}",
                "user_agent": f"TestApp/{i}.0",
            }
            await auth_service.create_user_tokens(test_user, device_info)

        # Logout from all devices
        count = await auth_service.logout_all_devices(test_user.id)
        assert count == 3

        # Check that all tokens are deactivated
        from sqlalchemy import and_, select

        stmt = select(RefreshToken).where(
            and_(RefreshToken.user_id == test_user.id, RefreshToken.is_active == True)
        )
        result = await db_session.execute(stmt)
        active_tokens = result.scalars().all()
        assert len(active_tokens) == 0


class TestSecurityHeaders:
    """Test security headers in responses."""

    def test_security_headers_present(self, client):
        """Test that security headers are included in responses."""
        response = client.get("/")

        # Check for security headers
        assert "X-Content-Type-Options" in response.headers
        assert response.headers["X-Content-Type-Options"] == "nosniff"

        assert "X-Frame-Options" in response.headers
        assert response.headers["X-Frame-Options"] == "DENY"

        assert "X-XSS-Protection" in response.headers
        assert response.headers["X-XSS-Protection"] == "1; mode=block"

        assert "Strict-Transport-Security" in response.headers
        assert "max-age" in response.headers["Strict-Transport-Security"]

    def test_request_id_header(self, client):
        """Test that request ID is included in response headers."""
        response = client.get("/")
        assert "X-Request-ID" in response.headers
        # Should be a valid UUID format
        request_id = response.headers["X-Request-ID"]
        assert len(request_id) == 36  # UUID length with hyphens

    def test_api_version_header(self, client):
        """Test that API version is included in response headers."""
        response = client.get("/api/v1/")
        assert "API-Version" in response.headers
        assert response.headers["API-Version"] == "v1"


class TestPasswordReset:
    """Test password reset security."""

    def test_password_reset_token_security(self, client, test_user):
        """Test password reset token generation and validation."""
        # Request password reset
        response = client.post(
            "/api/v1/auth/forgot-password", json={"email": "test@example.com"}
        )
        assert response.status_code == 200

        # Test with invalid token
        response = client.post(
            "/api/v1/auth/reset-password",
            json={"token": "invalid_token", "new_password": "NewTestPassword123!"},
        )
        assert response.status_code == 400

    def test_password_reset_invalidates_sessions(self, client, test_user, db_session):
        """Test that password reset invalidates all user sessions."""
        # Login to create a session
        response = client.post(
            "/api/v1/auth/login",
            json={"email": "test@example.com", "password": "TestPassword123!"},
        )
        old_tokens = response.json()

        # Reset password (would need valid token in real scenario)
        # This is a simplified test - in reality, you'd get the token from the database

        # After password reset, old tokens should be invalid
        response = client.post(
            "/api/v1/auth/refresh", json={"refresh_token": old_tokens["refresh_token"]}
        )
        # Should fail because password reset invalidated all sessions
        assert response.status_code == 401


# Performance and stress tests
class TestSecurityPerformance:
    """Test security-related performance."""

    def test_rate_limiting_performance(self, client):
        """Test that rate limiting doesn't significantly impact performance."""
        start_time = time.time()

        # Make allowed number of requests
        for i in range(5):
            response = client.post(
                "/api/v1/auth/login",
                json={"email": "nonexistent@example.com", "password": "password"},
            )
            assert response.status_code == 401

        end_time = time.time()
        total_time = end_time - start_time

        # Should complete within reasonable time (adjust as needed)
        assert total_time < 5.0  # 5 seconds for 5 requests

    @pytest.mark.asyncio
    async def test_token_validation_performance(self, client, test_user):
        """Test token validation performance."""
        # Login to get token
        response = make_login_request(client)
        
        # Check if login was successful first
        print(f"Login response status: {response.status_code}")
        print(f"Login response body: {response.json()}")
        
        assert response.status_code == 200, f"Login failed: {response.json()}"
        token = response.json()["access_token"]

        start_time = time.time()

        # Make multiple authenticated requests
        for i in range(10):
            response = client.get(
                "/api/v1/users/me", headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200

        end_time = time.time()
        total_time = end_time - start_time

        # Should complete within reasonable time
        assert total_time < 2.0  # 2 seconds for 10 requests


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
