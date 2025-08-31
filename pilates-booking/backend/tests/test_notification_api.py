import pytest
from datetime import datetime, timedelta
from typing import Dict, Any
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.notification import NotificationType, NotificationPriority
from app.services.notification_service import NotificationService
from app.main import app


class TestNotificationAPI:
    """Test suite for notification API endpoints"""

    @pytest.fixture
    def client(self):
        """Create test client"""
        return TestClient(app)

    @pytest.fixture
    async def test_user(self, db_session: AsyncSession) -> User:
        """Create test user"""
        user = User(
            email="testuser@example.com",
            hashed_password="hashed_password",
            first_name="Test",
            last_name="User",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def admin_user(self, db_session: AsyncSession) -> User:
        """Create admin user"""
        user = User(
            email="admin@example.com",
            hashed_password="hashed_password",
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    def user_token(self, test_user: User) -> str:
        """Generate JWT token for test user"""
        from app.core.security import create_access_token
        return create_access_token(subject=str(test_user.id))

    @pytest.fixture
    def admin_token(self, admin_user: User) -> str:
        """Generate JWT token for admin user"""
        from app.core.security import create_access_token
        return create_access_token(subject=str(admin_user.id))

    @pytest.fixture
    def auth_headers(self, user_token: str) -> Dict[str, str]:
        """Create authorization headers for test user"""
        return {"Authorization": f"Bearer {user_token}"}

    @pytest.fixture
    def admin_auth_headers(self, admin_token: str) -> Dict[str, str]:
        """Create authorization headers for admin user"""
        return {"Authorization": f"Bearer {admin_token}"}

    async def create_test_notification(
        self, 
        db_session: AsyncSession, 
        user: User,
        title: str = "Test Notification",
        body: str = "Test Body"
    ) -> int:
        """Helper to create test notification"""
        notification_service = NotificationService(db_session)
        notification = await notification_service.create_notification(
            user_id=user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title=title,
            body=body
        )
        return notification.id

    def test_get_notifications_success(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        test_user: User,
        db_session: AsyncSession
    ):
        """Test successful retrieval of user notifications"""
        
        # Create test notification
        asyncio.run(self.create_test_notification(db_session, test_user))
        
        response = client.get(
            "/api/v1/notifications/",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "notifications" in data
        assert "pagination" in data
        assert "unread_count" in data
        assert len(data["notifications"]) >= 1
        assert data["notifications"][0]["title"] == "Test Notification"

    def test_get_notifications_pagination(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        test_user: User,
        db_session: AsyncSession
    ):
        """Test notification pagination"""
        
        # Create multiple notifications
        for i in range(5):
            asyncio.run(self.create_test_notification(
                db_session, test_user, f"Notification {i}", f"Body {i}"
            ))
        
        # Test pagination parameters
        response = client.get(
            "/api/v1/notifications/?skip=0&limit=3",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["notifications"]) == 3
        assert data["pagination"]["total"] >= 5
        assert data["pagination"]["has_more"] is True

    def test_get_notifications_unread_only(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        test_user: User,
        db_session: AsyncSession
    ):
        """Test filtering for unread notifications only"""
        
        notification_id = asyncio.run(self.create_test_notification(db_session, test_user))
        
        # Mark one as read
        client.post(
            f"/api/v1/notifications/{notification_id}/mark-read",
            headers=auth_headers
        )
        
        # Create another unread notification
        asyncio.run(self.create_test_notification(
            db_session, test_user, "Unread", "Unread body"
        ))
        
        # Get unread only
        response = client.get(
            "/api/v1/notifications/?unread_only=true",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert len(data["notifications"]) == 1
        assert data["notifications"][0]["title"] == "Unread"

    def test_get_unread_count(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        test_user: User,
        db_session: AsyncSession
    ):
        """Test getting unread count"""
        
        # Create test notifications
        asyncio.run(self.create_test_notification(db_session, test_user))
        asyncio.run(self.create_test_notification(db_session, test_user))
        
        response = client.get(
            "/api/v1/notifications/unread-count",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "count" in data
        assert data["count"] >= 2

    def test_mark_notification_read(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        test_user: User,
        db_session: AsyncSession
    ):
        """Test marking single notification as read"""
        
        notification_id = asyncio.run(self.create_test_notification(db_session, test_user))
        
        response = client.post(
            f"/api/v1/notifications/{notification_id}/mark-read",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "message" in data
        assert "marked as read" in data["message"].lower()

    def test_mark_notification_read_not_found(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str]
    ):
        """Test marking non-existent notification as read"""
        
        response = client.post(
            "/api/v1/notifications/99999/mark-read",
            headers=auth_headers
        )
        
        assert response.status_code == 404

    def test_bulk_mark_read(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        test_user: User,
        db_session: AsyncSession
    ):
        """Test bulk marking notifications as read"""
        
        # Create multiple notifications
        notification_ids = []
        for i in range(3):
            notification_id = asyncio.run(self.create_test_notification(
                db_session, test_user, f"Test {i}", f"Body {i}"
            ))
            notification_ids.append(notification_id)
        
        response = client.post(
            "/api/v1/notifications/bulk-mark-read",
            headers=auth_headers,
            json={"notification_ids": notification_ids}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["marked_count"] == 3
        assert data["total_requested"] == 3

    def test_dismiss_notification(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        test_user: User,
        db_session: AsyncSession
    ):
        """Test dismissing notification"""
        
        notification_id = asyncio.run(self.create_test_notification(db_session, test_user))
        
        response = client.delete(
            f"/api/v1/notifications/{notification_id}",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "dismissed" in data["message"].lower()

    def test_create_notification_admin_only(
        self, 
        client: TestClient, 
        admin_auth_headers: Dict[str, str],
        test_user: User
    ):
        """Test creating notification (admin only)"""
        
        notification_data = {
            "user_id": test_user.id,
            "type": "booking_success",
            "title": "Admin Created Notification",
            "body": "This was created by admin",
            "priority": "normal"
        }
        
        response = client.post(
            "/api/v1/notifications/create",
            headers=admin_auth_headers,
            json=notification_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "notification_id" in data
        assert "message" in data

    def test_create_notification_forbidden_for_regular_user(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        test_user: User
    ):
        """Test that regular users cannot create notifications"""
        
        notification_data = {
            "user_id": test_user.id,
            "type": "booking_success",
            "title": "User Created Notification",
            "body": "This should not be allowed",
            "priority": "normal"
        }
        
        response = client.post(
            "/api/v1/notifications/create",
            headers=auth_headers,
            json=notification_data
        )
        
        assert response.status_code == 403

    def test_create_bulk_notifications_admin_only(
        self, 
        client: TestClient, 
        admin_auth_headers: Dict[str, str],
        test_user: User,
        db_session: AsyncSession
    ):
        """Test creating bulk notifications (admin only)"""
        
        # Create additional test user
        user2 = User(
            email="user2@example.com",
            hashed_password="password",
            first_name="User2",
            last_name="Test",
            role=UserRole.STUDENT,
            is_active=True
        )
        db_session.add(user2)
        asyncio.run(db_session.commit())
        asyncio.run(db_session.refresh(user2))
        
        notification_data = {
            "user_ids": [test_user.id, user2.id],
            "type": "general_announcement",
            "title": "Bulk Notification",
            "body": "This is a bulk notification",
            "priority": "normal"
        }
        
        response = client.post(
            "/api/v1/notifications/create-bulk",
            headers=admin_auth_headers,
            json=notification_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["notifications_created"] == 2
        assert data["target_users"] == 2

    def test_create_broadcast_notification_admin_only(
        self, 
        client: TestClient, 
        admin_auth_headers: Dict[str, str]
    ):
        """Test creating broadcast notification (admin only)"""
        
        notification_data = {
            "target_roles": ["student"],
            "type": "admin_announcement",
            "title": "System Maintenance",
            "body": "System will be down for maintenance",
            "priority": "high"
        }
        
        response = client.post(
            "/api/v1/notifications/broadcast",
            headers=admin_auth_headers,
            json=notification_data
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "notifications_created" in data
        assert "target_roles" in data
        assert data["target_roles"] == ["student"]

    def test_render_template(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str],
        db_session: AsyncSession
    ):
        """Test notification template rendering"""
        
        # First seed a template (you might need to create this beforehand)
        from app.services.notification_template_service import seed_default_templates
        asyncio.run(seed_default_templates(db_session))
        
        render_request = {
            "notification_type": "booking_success",
            "language": "en",
            "variables": {
                "class_name": "Pilates Basics",
                "date": "2025-08-27",
                "time": "10:00"
            }
        }
        
        response = client.post(
            "/api/v1/notifications/render-template",
            headers=auth_headers,
            json=render_request
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "title" in data
        assert "body" in data
        assert "Pilates Basics" in data["body"]

    def test_get_notification_types(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str]
    ):
        """Test getting available notification types"""
        
        response = client.get(
            "/api/v1/notifications/types",
            headers=auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "notification_types" in data
        assert len(data["notification_types"]) > 0
        assert any(nt["value"] == "booking_success" for nt in data["notification_types"])

    def test_cleanup_notifications_admin_only(
        self, 
        client: TestClient, 
        admin_auth_headers: Dict[str, str]
    ):
        """Test notification cleanup (admin only)"""
        
        response = client.post(
            "/api/v1/notifications/cleanup?days=30",
            headers=admin_auth_headers
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert "cleanup_stats" in data
        assert "message" in data

    def test_cleanup_notifications_forbidden_for_regular_user(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str]
    ):
        """Test that regular users cannot trigger cleanup"""
        
        response = client.post(
            "/api/v1/notifications/cleanup",
            headers=auth_headers
        )
        
        assert response.status_code == 403

    def test_unauthorized_access(
        self, 
        client: TestClient
    ):
        """Test that unauthorized users cannot access notification endpoints"""
        
        # Test without authentication headers
        response = client.get("/api/v1/notifications/")
        assert response.status_code == 401
        
        response = client.get("/api/v1/notifications/unread-count")
        assert response.status_code == 401
        
        response = client.post("/api/v1/notifications/1/mark-read")
        assert response.status_code == 401

    def test_invalid_notification_id(
        self, 
        client: TestClient, 
        auth_headers: Dict[str, str]
    ):
        """Test operations with invalid notification IDs"""
        
        # Test with string instead of integer
        response = client.post(
            "/api/v1/notifications/invalid_id/mark-read",
            headers=auth_headers
        )
        
        assert response.status_code == 422  # Validation error

    def test_validation_errors(
        self, 
        client: TestClient, 
        admin_auth_headers: Dict[str, str]
    ):
        """Test various validation errors in API"""
        
        # Test empty title
        invalid_data = {
            "user_id": 1,
            "type": "booking_success",
            "title": "",  # Empty title
            "body": "Valid body"
        }
        
        response = client.post(
            "/api/v1/notifications/create",
            headers=admin_auth_headers,
            json=invalid_data
        )
        
        assert response.status_code == 400
        
        # Test invalid notification type
        invalid_data = {
            "user_id": 1,
            "type": "invalid_type",  # Invalid type
            "title": "Valid title",
            "body": "Valid body"
        }
        
        response = client.post(
            "/api/v1/notifications/create",
            headers=admin_auth_headers,
            json=invalid_data
        )
        
        assert response.status_code == 422  # Validation error