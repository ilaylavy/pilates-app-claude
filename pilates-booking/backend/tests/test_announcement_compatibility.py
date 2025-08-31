import pytest
from datetime import datetime, timedelta
from typing import List, Dict, Any
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.announcement import Announcement, AnnouncementType
from app.models.notification import (
    Notification, 
    NotificationType, 
    NotificationPriority
)
from app.services.announcement_compatibility_service import AnnouncementCompatibilityService
from app.services.notification_service import NotificationService


class TestAnnouncementCompatibilityService:
    """Test suite for AnnouncementCompatibilityService"""

    @pytest.fixture
    async def compatibility_service(self, db_session: AsyncSession):
        """Create compatibility service instance"""
        return AnnouncementCompatibilityService(db_session)

    @pytest.fixture
    async def notification_service(self, db_session: AsyncSession):
        """Create notification service instance"""
        return NotificationService(db_session)

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

    @pytest.fixture
    async def legacy_announcement(
        self, 
        db_session: AsyncSession, 
        admin_user: User
    ) -> Announcement:
        """Create legacy announcement"""
        announcement = Announcement(
            title="Legacy Announcement",
            message="This is a legacy announcement",
            type="info",
            created_by=admin_user.id,
            is_active=True,
            is_dismissible=True,
            target_roles=["student"]
        )
        db_session.add(announcement)
        await db_session.commit()
        await db_session.refresh(announcement)
        return announcement

    async def test_get_user_announcements_legacy_only(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        test_user: User,
        legacy_announcement: Announcement
    ):
        """Test retrieving legacy announcements only"""
        
        announcements = await compatibility_service.get_user_announcements_legacy(
            user=test_user,
            include_dismissed=False
        )
        
        assert len(announcements) == 1
        assert announcements[0]["title"] == "Legacy Announcement"
        assert announcements[0]["_is_notification"] is False
        assert announcements[0]["type"] == "info"

    async def test_get_user_announcements_notifications_only(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        notification_service: NotificationService,
        test_user: User,
        admin_user: User
    ):
        """Test retrieving notification-based announcements only"""
        
        # Create notification that should appear as announcement
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.ADMIN_ANNOUNCEMENT,
            title="Notification Announcement",
            body="This notification appears as announcement",
            sender_id=admin_user.id
        )
        
        announcements = await compatibility_service.get_user_announcements_legacy(
            user=test_user,
            include_dismissed=False
        )
        
        assert len(announcements) == 1
        assert announcements[0]["title"] == "Notification Announcement"
        assert announcements[0]["_is_notification"] is True
        assert announcements[0]["type"] == "warning"  # Mapped from admin_announcement

    async def test_get_user_announcements_mixed(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        notification_service: NotificationService,
        test_user: User,
        admin_user: User,
        legacy_announcement: Announcement
    ):
        """Test retrieving both legacy and notification announcements"""
        
        # Create notification announcement
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.URGENT_ANNOUNCEMENT,
            title="Urgent Notification",
            body="This is urgent",
            sender_id=admin_user.id
        )
        
        announcements = await compatibility_service.get_user_announcements_legacy(
            user=test_user,
            include_dismissed=False
        )
        
        assert len(announcements) == 2
        
        # Find each announcement
        legacy_ann = next(a for a in announcements if not a["_is_notification"])
        notification_ann = next(a for a in announcements if a["_is_notification"])
        
        assert legacy_ann["title"] == "Legacy Announcement"
        assert notification_ann["title"] == "Urgent Notification"
        assert notification_ann["type"] == "urgent"  # Mapped from urgent_announcement

    async def test_notification_type_mapping(
        self, 
        compatibility_service: AnnouncementCompatibilityService
    ):
        """Test notification type to announcement type mapping"""
        
        # Test the internal mapping function
        test_cases = [
            (NotificationType.URGENT_ANNOUNCEMENT, "urgent"),
            (NotificationType.ADMIN_ANNOUNCEMENT, "warning"),
            (NotificationType.GENERAL_ANNOUNCEMENT, "info"),
            (NotificationType.SYSTEM_MAINTENANCE, "urgent"),
            (NotificationType.BOOKING_SUCCESS, "success"),
            (NotificationType.PAYMENT_FAILED, "urgent"),
            (NotificationType.CLASS_REMINDER, "info"),
        ]
        
        for notification_type, expected_announcement_type in test_cases:
            mapped_type = compatibility_service._map_notification_type_to_announcement_type(
                notification_type
            )
            assert mapped_type == expected_announcement_type

    async def test_dismiss_notification_announcement(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        notification_service: NotificationService,
        test_user: User
    ):
        """Test dismissing a notification-based announcement"""
        
        # Create notification
        notification = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.ADMIN_ANNOUNCEMENT,
            title="Test Notification",
            body="Test body"
        )
        
        # Dismiss via compatibility service
        success = await compatibility_service.dismiss_announcement_legacy(
            announcement_id=notification.id,
            user=test_user
        )
        
        assert success is True
        
        # Verify it's dismissed (should not appear in announcements)
        announcements = await compatibility_service.get_user_announcements_legacy(
            user=test_user,
            include_dismissed=False
        )
        
        assert len(announcements) == 0

    async def test_dismiss_legacy_announcement(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        test_user: User,
        legacy_announcement: Announcement
    ):
        """Test dismissing a legacy announcement"""
        
        # For legacy announcements, dismissal should return True
        # but actual dismissal is handled by mobile app local storage
        success = await compatibility_service.dismiss_announcement_legacy(
            announcement_id=legacy_announcement.id,
            user=test_user
        )
        
        assert success is True

    async def test_dismiss_nonexistent_announcement(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        test_user: User
    ):
        """Test dismissing non-existent announcement"""
        
        success = await compatibility_service.dismiss_announcement_legacy(
            announcement_id=99999,  # Non-existent ID
            user=test_user
        )
        
        assert success is False

    async def test_role_based_filtering(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        notification_service: NotificationService,
        db_session: AsyncSession,
        admin_user: User
    ):
        """Test role-based filtering of announcements"""
        
        # Create student and instructor users
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
        
        # Create legacy announcement for students only
        student_announcement = Announcement(
            title="Student Only",
            message="This is for students only",
            type="info",
            created_by=admin_user.id,
            is_active=True,
            target_roles=["student"]
        )
        db_session.add(student_announcement)
        
        # Create notification for instructors
        await notification_service.create_notification(
            user_id=instructor.id,
            notification_type=NotificationType.ADMIN_ANNOUNCEMENT,
            title="Instructor Notification",
            body="This is for instructor"
        )
        
        await db_session.commit()
        
        # Student should see the legacy announcement
        student_announcements = await compatibility_service.get_user_announcements_legacy(student)
        assert len(student_announcements) == 1
        assert student_announcements[0]["title"] == "Student Only"
        
        # Instructor should see the notification
        instructor_announcements = await compatibility_service.get_user_announcements_legacy(instructor)
        assert len(instructor_announcements) == 1
        assert instructor_announcements[0]["title"] == "Instructor Notification"

    async def test_expired_announcements_filtered(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        db_session: AsyncSession,
        test_user: User,
        admin_user: User
    ):
        """Test that expired announcements are filtered out"""
        
        # Create expired legacy announcement
        past_date = datetime.utcnow() - timedelta(hours=1)
        expired_announcement = Announcement(
            title="Expired Announcement",
            message="This is expired",
            type="info",
            created_by=admin_user.id,
            is_active=True,
            expires_at=past_date,
            target_roles=["student"]
        )
        db_session.add(expired_announcement)
        await db_session.commit()
        
        announcements = await compatibility_service.get_user_announcements_legacy(test_user)
        
        # Should not include expired announcement
        assert len(announcements) == 0

    async def test_include_dismissed_parameter(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        notification_service: NotificationService,
        test_user: User
    ):
        """Test include_dismissed parameter functionality"""
        
        # Create and dismiss a notification
        notification = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.ADMIN_ANNOUNCEMENT,
            title="Dismissed Notification",
            body="This will be dismissed"
        )
        
        await compatibility_service.dismiss_announcement_legacy(
            announcement_id=notification.id,
            user=test_user
        )
        
        # Should not appear when include_dismissed=False
        announcements_excluded = await compatibility_service.get_user_announcements_legacy(
            user=test_user,
            include_dismissed=False
        )
        assert len(announcements_excluded) == 0
        
        # Should appear when include_dismissed=True
        announcements_included = await compatibility_service.get_user_announcements_legacy(
            user=test_user,
            include_dismissed=True
        )
        assert len(announcements_included) == 1
        assert announcements_included[0]["_is_dismissed"] is True

    async def test_get_announcement_statistics(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        notification_service: NotificationService,
        test_user: User,
        admin_user: User,
        legacy_announcement: Announcement
    ):
        """Test getting announcement statistics"""
        
        # Create notification announcement
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.ADMIN_ANNOUNCEMENT,
            title="Stats Test Notification",
            body="For statistics"
        )
        
        stats = await compatibility_service.get_announcement_statistics()
        
        assert "legacy_announcements" in stats
        assert "notification_announcements" in stats
        assert "total_announcements" in stats
        assert "user_counts" in stats
        assert "migration_progress" in stats
        
        assert stats["legacy_announcements"] >= 1
        assert stats["notification_announcements"] >= 1
        assert stats["total_announcements"] >= 2

    async def test_health_check(
        self, 
        compatibility_service: AnnouncementCompatibilityService
    ):
        """Test compatibility service health check"""
        
        health = await compatibility_service.health_check()
        
        assert "status" in health
        assert "database_connection" in health
        assert "notification_service" in health
        assert "timestamp" in health
        
        # Should be healthy if everything works
        assert health["status"] == "healthy"
        assert health["database_connection"] == "ok"
        assert health["notification_service"] == "ok"

    async def test_chronological_sorting(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        notification_service: NotificationService,
        test_user: User,
        admin_user: User,
        db_session: AsyncSession
    ):
        """Test that mixed announcements are sorted chronologically"""
        
        # Create legacy announcement with specific timestamp
        old_date = datetime.utcnow() - timedelta(hours=2)
        old_announcement = Announcement(
            title="Old Legacy",
            message="This is old",
            type="info",
            created_by=admin_user.id,
            is_active=True,
            target_roles=["student"],
            created_at=old_date
        )
        db_session.add(old_announcement)
        await db_session.commit()
        
        # Create recent notification
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.ADMIN_ANNOUNCEMENT,
            title="New Notification",
            body="This is new"
        )
        
        announcements = await compatibility_service.get_user_announcements_legacy(test_user)
        
        assert len(announcements) == 2
        # Newest should be first (descending order)
        assert announcements[0]["title"] == "New Notification"
        assert announcements[1]["title"] == "Old Legacy"

    async def test_notification_metadata_preservation(
        self, 
        compatibility_service: AnnouncementCompatibilityService,
        notification_service: NotificationService,
        test_user: User
    ):
        """Test that notification metadata is preserved in compatibility format"""
        
        # Create notification with metadata
        notification = await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Booking Confirmed",
            body="Your booking is confirmed",
            data={"class_id": 123, "instructor": "Jane"},
            source_type="booking",
            source_id=456,
            metadata={"booking_ref": "BK-789"}
        )
        
        announcements = await compatibility_service.get_user_announcements_legacy(test_user)
        
        # Booking notifications normally don't appear as announcements,
        # but let's test with admin announcement
        await notification_service.create_notification(
            user_id=test_user.id,
            notification_type=NotificationType.ADMIN_ANNOUNCEMENT,
            title="Admin Notice",
            body="Admin message",
            source_type="admin",
            source_id=789
        )
        
        announcements = await compatibility_service.get_user_announcements_legacy(test_user)
        announcement = announcements[0]
        
        assert announcement["_notification_id"] is not None
        assert announcement["_is_notification"] is True
        assert announcement["_priority"] == "normal"