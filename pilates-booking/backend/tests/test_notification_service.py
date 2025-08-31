import pytest
import asyncio
from datetime import datetime, timedelta
from typing import List
from unittest.mock import AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
import redis.asyncio as redis

from app.models.notification import (
    Notification, 
    NotificationRead, 
    NotificationTemplate,
    NotificationType, 
    NotificationPriority
)
from app.models.user import User, UserRole
from app.services.notification_service import (
    NotificationService,
    NotificationError,
    NotificationQuotaExceeded,
    InvalidNotificationType,
    NotificationValidationError,
    MAX_NOTIFICATIONS_PER_HOUR
)


class TestNotificationService:
    """Test suite for NotificationService"""

    @pytest.fixture
    async def notification_service(self, db_session: AsyncSession, redis_mock):
        """Create NotificationService instance for testing"""
        return NotificationService(db_session, redis_mock)

    @pytest.fixture
    def redis_mock(self):
        """Mock Redis client"""
        mock_redis = AsyncMock(spec=redis.Redis)
        mock_redis.get = AsyncMock(return_value=None)
        mock_redis.incr = AsyncMock(return_value=1)
        mock_redis.expire = AsyncMock(return_value=True)
        return mock_redis

    @pytest.fixture
    async def test_user(self, db_session: AsyncSession) -> User:
        """Create test user"""
        user = User(
            email="test@example.com",
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

    async def test_create_notification_success(
        self, 
        notification_service: NotificationService,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test successful notification creation"""
        
        notification = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Test Booking Confirmed",
            body="Your booking has been confirmed",
            data={"class_id": 123},
            priority=NotificationPriority.NORMAL
        )
        
        assert notification.id is not None
        assert notification.user_id == test_user.id
        assert notification.type == NotificationType.BOOKING_SUCCESS
        assert notification.title == "Test Booking Confirmed"
        assert notification.body == "Your booking has been confirmed"
        assert notification.data_json == {"class_id": 123}
        assert notification.priority == NotificationPriority.NORMAL
        assert notification.is_broadcast is False

    async def test_create_notification_auto_priority(
        self, 
        notification_service: NotificationService,
        test_user: User
    ):
        """Test automatic priority assignment"""
        
        # Test critical priority auto-assignment
        notification = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.PAYMENT_FAILED,
            title="Payment Failed",
            body="Your payment could not be processed"
        )
        
        assert notification.priority == NotificationPriority.CRITICAL

    async def test_create_notification_validation_errors(
        self, 
        notification_service: NotificationService,
        test_user: User
    ):
        """Test validation errors in notification creation"""
        
        # Test empty title
        with pytest.raises(NotificationValidationError, match="Title cannot be empty"):
            await notification_service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.BOOKING_SUCCESS,
                title="",
                body="Valid body"
            )
        
        # Test empty body
        with pytest.raises(NotificationValidationError, match="Body cannot be empty"):
            await notification_service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.BOOKING_SUCCESS,
                title="Valid title",
                body=""
            )
        
        # Test title too long
        with pytest.raises(NotificationValidationError, match="Title exceeds"):
            await notification_service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.BOOKING_SUCCESS,
                title="x" * 201,  # Exceeds MAX_TITLE_LENGTH
                body="Valid body"
            )

    async def test_create_notification_invalid_user(
        self, 
        notification_service: NotificationService
    ):
        """Test notification creation with invalid user ID"""
        
        with pytest.raises(NotificationValidationError, match="User .* not found"):
            await notification_service.create_notification(
                user_id=99999,  # Non-existent user
                notification_type=NotificationType.BOOKING_SUCCESS,
                title="Test",
                body="Test"
            )

    async def test_rate_limiting(
        self, 
        notification_service: NotificationService,
        test_user: User,
        redis_mock
    ):
        """Test rate limiting functionality"""
        
        # Mock Redis to return quota exceeded
        redis_mock.get.return_value = str(MAX_NOTIFICATIONS_PER_HOUR)
        
        with pytest.raises(NotificationQuotaExceeded):
            await notification_service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.BOOKING_SUCCESS,
                title="Test",
                body="Test"
            )

    async def test_create_bulk_notifications(
        self, 
        notification_service: NotificationService,
        db_session: AsyncSession
    ):
        """Test bulk notification creation"""
        
        # Create multiple test users
        users = []
        for i in range(3):
            user = User(
                email=f"user{i}@example.com",
                hashed_password="password",
                first_name=f"User{i}",
                last_name="Test",
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True
            )
            users.append(user)
            db_session.add(user)
        
        await db_session.commit()
        
        user_ids = [user.id for user in users]
        
        notifications = await notification_service.create_bulk_notifications(
            user_ids=user_ids,
            notification_type=NotificationType.GENERAL_ANNOUNCEMENT,
            title="Bulk Notification",
            body="This is a bulk notification"
        )
        
        assert len(notifications) == 3
        for notification in notifications:
            assert notification.type == NotificationType.GENERAL_ANNOUNCEMENT
            assert notification.title == "Bulk Notification"
            assert notification.is_broadcast is False

    async def test_create_broadcast_notification(
        self, 
        notification_service: NotificationService,
        db_session: AsyncSession
    ):
        """Test broadcast notification creation"""
        
        # Create users with different roles
        student = User(
            email="student@example.com",
            hashed_password="password",
            first_name="Student",
            last_name="User",
            role=UserRole.STUDENT,
            is_active=True
        )
        instructor = User(
            email="instructor@example.com",
            hashed_password="password",
            first_name="Instructor",
            last_name="User",
            role=UserRole.INSTRUCTOR,
            is_active=True
        )
        db_session.add_all([student, instructor])
        await db_session.commit()
        
        # Broadcast to students only
        notifications = await notification_service.create_broadcast_notification(
            target_roles=[UserRole.STUDENT],
            notification_type=NotificationType.ADMIN_ANNOUNCEMENT,
            title="Student Announcement",
            body="This is for students only"
        )
        
        assert len(notifications) == 1  # Only one student
        assert notifications[0].user_id == student.id
        assert notifications[0].is_broadcast is True

    async def test_get_user_notifications(
        self, 
        notification_service: NotificationService,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test getting user notifications with pagination"""
        
        # Create test notifications
        for i in range(5):
            await notification_service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.BOOKING_SUCCESS,
                title=f"Notification {i}",
                body=f"Body {i}"
            )
        
        # Test pagination
        result = await notification_service.get_user_notifications(
            user_id=test_user.id,
            skip=0,
            limit=3
        )
        
        assert len(result.notifications) == 3
        assert result.pagination["total"] == 5
        assert result.pagination["has_more"] is True
        assert result.unread_count == 5

    async def test_mark_as_read(
        self, 
        notification_service: NotificationService,
        test_user: User
    ):
        """Test marking notification as read"""
        
        # Create notification
        notification = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Test",
            body="Test"
        )
        
        # Mark as read
        success = await notification_service.mark_as_read(notification.id, test_user.id)
        assert success is True
        
        # Verify unread count decreased
        unread_count = await notification_service.get_unread_count(test_user.id)
        assert unread_count == 0

    async def test_mark_as_dismissed(
        self, 
        notification_service: NotificationService,
        test_user: User
    ):
        """Test dismissing notification"""
        
        # Create notification
        notification = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Test",
            body="Test"
        )
        
        # Dismiss notification
        success = await notification_service.mark_as_dismissed(notification.id, test_user.id)
        assert success is True

    async def test_bulk_mark_read(
        self, 
        notification_service: NotificationService,
        test_user: User
    ):
        """Test bulk marking notifications as read"""
        
        # Create multiple notifications
        notifications = []
        for i in range(3):
            notification = await notification_service.create_notification(
                user_id=test_user.id,
                notification_type=NotificationType.BOOKING_SUCCESS,
                title=f"Test {i}",
                body=f"Test {i}"
            )
            notifications.append(notification)
        
        notification_ids = [n.id for n in notifications]
        
        # Bulk mark as read
        marked_count = await notification_service.bulk_mark_read(notification_ids, test_user.id)
        assert marked_count == 3
        
        # Verify unread count
        unread_count = await notification_service.get_unread_count(test_user.id)
        assert unread_count == 0

    async def test_cleanup_old_notifications(
        self, 
        notification_service: NotificationService,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test cleanup of old notifications"""
        
        # Create old notification by manually setting created_at
        old_date = datetime.utcnow() - timedelta(days=35)
        
        notification = Notification(
            user_id=test_user.id,
            type=NotificationType.BOOKING_SUCCESS,
            title="Old Notification",
            body="This is old",
            priority=NotificationPriority.NORMAL,
            created_at=old_date
        )
        db_session.add(notification)
        await db_session.commit()
        
        # Run cleanup
        stats = await notification_service.cleanup_old_notifications(days=30)
        
        assert stats["archived_normal"] >= 1
        
        # Verify notification is archived
        await db_session.refresh(notification)
        assert notification.archived_at is not None

    async def test_get_unread_count(
        self, 
        notification_service: NotificationService,
        test_user: User
    ):
        """Test getting unread count"""
        
        # Initially should be 0
        count = await notification_service.get_unread_count(test_user.id)
        assert count == 0
        
        # Create notifications
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Test 1",
            body="Test 1"
        )
        
        notification2 = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Test 2",
            body="Test 2"
        )
        
        # Should be 2 unread
        count = await notification_service.get_unread_count(test_user.id)
        assert count == 2
        
        # Mark one as read
        await notification_service.mark_as_read(notification2.id, test_user.id)
        
        # Should be 1 unread
        count = await notification_service.get_unread_count(test_user.id)
        assert count == 1

    async def test_notification_expiry(
        self, 
        notification_service: NotificationService,
        test_user: User,
        db_session: AsyncSession
    ):
        """Test that expired notifications are filtered out"""
        
        # Create expired notification
        past_date = datetime.utcnow() - timedelta(hours=1)
        
        expired_notification = Notification(
            user_id=test_user.id,
            type=NotificationType.BOOKING_SUCCESS,
            title="Expired",
            body="This is expired",
            expires_at=past_date,
            priority=NotificationPriority.NORMAL
        )
        db_session.add(expired_notification)
        
        # Create valid notification
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Valid",
            body="This is valid"
        )
        
        await db_session.commit()
        
        # Get notifications - should only return the valid one
        result = await notification_service.get_user_notifications(test_user.id)
        
        assert len(result.notifications) == 1
        assert result.notifications[0]["title"] == "Valid"

    async def test_notification_filtering_by_type(
        self, 
        notification_service: NotificationService,
        test_user: User
    ):
        """Test filtering notifications by type"""
        
        # Create notifications of different types
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Booking",
            body="Booking notification"
        )
        
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.PAYMENT_PROCESSED,
            title="Payment",
            body="Payment notification"
        )
        
        # Filter by booking type only
        result = await notification_service.get_user_notifications(
            user_id=test_user.id,
            types=[NotificationType.BOOKING_SUCCESS]
        )
        
        assert len(result.notifications) == 1
        assert result.notifications[0]["title"] == "Booking"

    async def test_source_tracking(
        self, 
        notification_service: NotificationService,
        test_user: User
    ):
        """Test source tracking functionality"""
        
        notification = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Test",
            body="Test",
            source_type="booking",
            source_id=123,
            metadata={"additional_info": "test"}
        )
        
        assert notification.source_type == "booking"
        assert notification.source_id == 123
        assert notification.metadata == {"additional_info": "test"}