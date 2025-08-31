"""
Announcement Compatibility Service

This service provides a compatibility layer between the old announcement system
and the new notification system. It ensures existing mobile apps continue to work
during the transition period.

Key features:
- Transforms notifications back to announcement format
- Maintains backward compatibility with existing API contracts
- Handles read/dismissed state translation
- Provides migration support during rollout
"""

import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.announcement import Announcement
from ..models.notification import Notification, NotificationRead, NotificationType
from ..models.user import User, UserRole
from ..services.notification_service import NotificationService

logger = logging.getLogger("announcement_compatibility")


class AnnouncementCompatibilityService:
    """Service to maintain backward compatibility with announcement API"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_service = NotificationService(db)

    def _map_notification_type_to_announcement_type(self, notification_type: NotificationType) -> str:
        """Map notification types back to announcement types"""
        mapping = {
            NotificationType.URGENT_ANNOUNCEMENT: "urgent",
            NotificationType.ADMIN_ANNOUNCEMENT: "warning",
            NotificationType.GENERAL_ANNOUNCEMENT: "info",
            NotificationType.SYSTEM_MAINTENANCE: "urgent",
            NotificationType.BOOKING_SUCCESS: "success",
            NotificationType.PACKAGE_ACTIVATED: "success",
            NotificationType.PAYMENT_PROCESSED: "success",
            NotificationType.PAYMENT_FAILED: "urgent",
            NotificationType.CLASS_REMINDER: "info",
            NotificationType.WAITLIST_PROMOTED: "success",
            NotificationType.ACCOUNT_VERIFIED: "success"
        }
        return mapping.get(notification_type, "info")

    def _transform_notification_to_announcement_format(
        self, 
        notification: Notification, 
        user: User
    ) -> Dict[str, Any]:
        """Transform notification to legacy announcement format"""
        
        # Check read status
        is_read = notification.is_read_by_user(user.id)
        is_dismissed = notification.is_dismissed_by_user(user.id)
        
        return {
            "id": notification.id,  # Use notification ID for compatibility
            "title": notification.title,
            "message": notification.body,
            "type": self._map_notification_type_to_announcement_type(notification.type),
            "created_at": notification.created_at.isoformat(),
            "expires_at": notification.expires_at.isoformat() if notification.expires_at else None,
            "is_active": notification.is_visible and not is_dismissed,
            "is_dismissible": True,
            "target_roles": None,  # Legacy field, notifications handle this differently
            "created_by": notification.sender_id,
            "deleted_at": None,
            # Additional fields for mobile app compatibility
            "_notification_id": notification.id,
            "_is_notification": True,  # Flag to identify source
            "_is_read": is_read,
            "_is_dismissed": is_dismissed,
            "_priority": notification.priority.value
        }

    async def get_user_announcements_legacy(
        self, 
        user: User, 
        include_dismissed: bool = False
    ) -> List[Dict[str, Any]]:
        """
        Get user announcements in legacy format (your enhancement #9)
        
        This method:
        1. Fetches both legacy announcements and new notifications
        2. Transforms them to the old format
        3. Merges and sorts them chronologically
        4. Filters based on user role and read status
        """
        
        logger.debug(f"Fetching legacy announcements for user {user.id}")
        
        legacy_announcements = []
        
        # Step 1: Get legacy announcements (still active during transition)
        legacy_stmt = select(Announcement).where(
            Announcement.is_active == True,
            Announcement.deleted_at.is_(None),
            or_(
                Announcement.expires_at.is_(None),
                Announcement.expires_at > func.now()
            )
        ).order_by(Announcement.created_at.desc())
        
        legacy_result = await self.db.execute(legacy_stmt)
        legacy_announcement_records = legacy_result.scalars().all()
        
        # Process legacy announcements
        for announcement in legacy_announcement_records:
            # Check if announcement targets user's role
            if announcement.is_for_role(user.role.value):
                announcement_dict = {
                    "id": announcement.id,
                    "title": announcement.title,
                    "message": announcement.message,
                    "type": announcement.type,
                    "created_at": announcement.created_at.isoformat(),
                    "expires_at": announcement.expires_at.isoformat() if announcement.expires_at else None,
                    "is_active": announcement.is_active,
                    "is_dismissible": announcement.is_dismissible,
                    "target_roles": announcement.target_roles,
                    "created_by": announcement.created_by,
                    "deleted_at": None,
                    "_notification_id": None,
                    "_is_notification": False,
                    "_is_read": False,  # Legacy announcements don't track read state
                    "_is_dismissed": False,
                    "_priority": "normal"
                }
                legacy_announcements.append(announcement_dict)
        
        # Step 2: Get new notifications that should appear as announcements
        notification_types_as_announcements = [
            NotificationType.ADMIN_ANNOUNCEMENT,
            NotificationType.URGENT_ANNOUNCEMENT,
            NotificationType.GENERAL_ANNOUNCEMENT,
            NotificationType.SYSTEM_MAINTENANCE
        ]
        
        # Build notification query
        notification_stmt = (
            select(Notification)
            .where(
                Notification.user_id == user.id,
                Notification.type.in_(notification_types_as_announcements),
                Notification.deleted_at.is_(None),
                Notification.archived_at.is_(None),
                or_(
                    Notification.expires_at.is_(None),
                    Notification.expires_at > func.now()
                )
            )
            .order_by(Notification.created_at.desc())
        )
        
        # Apply dismissal filter
        if not include_dismissed:
            # Exclude dismissed notifications
            dismissed_subquery = (
                select(NotificationRead.notification_id)
                .where(
                    NotificationRead.user_id == user.id,
                    NotificationRead.dismissed_at.is_not(None)
                )
            )
            notification_stmt = notification_stmt.where(
                ~Notification.id.in_(dismissed_subquery)
            )
        
        notification_result = await self.db.execute(notification_stmt)
        notifications = notification_result.scalars().all()
        
        # Transform notifications to announcement format
        notification_announcements = []
        for notification in notifications:
            transformed = self._transform_notification_to_announcement_format(notification, user)
            notification_announcements.append(transformed)
        
        # Step 3: Merge and sort all announcements by created_at
        all_announcements = legacy_announcements + notification_announcements
        all_announcements.sort(key=lambda x: x["created_at"], reverse=True)
        
        logger.info(f"Retrieved {len(legacy_announcements)} legacy + {len(notification_announcements)} notification announcements for user {user.id}")
        
        return all_announcements

    async def dismiss_announcement_legacy(
        self, 
        announcement_id: int, 
        user: User
    ) -> bool:
        """
        Handle dismissal in legacy format
        
        This method detects whether the ID refers to a legacy announcement
        or a new notification and handles accordingly.
        """
        
        logger.debug(f"Dismissing announcement/notification {announcement_id} for user {user.id}")
        
        # First, check if it's a new notification
        notification_stmt = select(Notification).where(
            Notification.id == announcement_id,
            Notification.user_id == user.id
        )
        notification_result = await self.db.execute(notification_stmt)
        notification = notification_result.scalar_one_or_none()
        
        if notification:
            # It's a notification, use notification dismissal
            success = await self.notification_service.mark_as_dismissed(announcement_id, user.id)
            logger.info(f"Dismissed notification {announcement_id} for user {user.id}: {success}")
            return success
        
        # If not a notification, it might be a legacy announcement
        # For legacy announcements, we need to store dismissal state separately
        # or handle it in the mobile app's local storage (as it currently does)
        
        # Check if legacy announcement exists
        announcement_stmt = select(Announcement).where(
            Announcement.id == announcement_id,
            Announcement.is_active == True,
            Announcement.deleted_at.is_(None)
        )
        announcement_result = await self.db.execute(announcement_stmt)
        announcement = announcement_result.scalar_one_or_none()
        
        if announcement and announcement.is_for_role(user.role.value):
            # Legacy announcement exists and user can see it
            # Since legacy system doesn't track dismissals per user,
            # we return True to maintain compatibility
            # The mobile app will handle local dismissal state
            logger.info(f"Legacy announcement {announcement_id} dismissal handled locally for user {user.id}")
            return True
        
        logger.warning(f"Announcement/notification {announcement_id} not found for user {user.id}")
        return False

    async def get_announcement_statistics(self) -> Dict[str, Any]:
        """Get statistics about legacy vs new notification usage"""
        
        # Count legacy announcements
        legacy_count = await self.db.scalar(
            select(func.count(Announcement.id)).where(
                Announcement.is_active == True,
                Announcement.deleted_at.is_(None)
            )
        )
        
        # Count notification-based announcements
        announcement_notification_types = [
            NotificationType.ADMIN_ANNOUNCEMENT,
            NotificationType.URGENT_ANNOUNCEMENT,
            NotificationType.GENERAL_ANNOUNCEMENT,
            NotificationType.SYSTEM_MAINTENANCE
        ]
        
        notification_count = await self.db.scalar(
            select(func.count(Notification.id)).where(
                Notification.type.in_(announcement_notification_types),
                Notification.deleted_at.is_(None),
                Notification.archived_at.is_(None)
            )
        )
        
        # Count total users by role
        user_counts = {}
        for role in UserRole:
            count = await self.db.scalar(
                select(func.count(User.id)).where(
                    User.role == role,
                    User.is_active == True
                )
            )
            user_counts[role.value] = count
        
        return {
            "legacy_announcements": legacy_count,
            "notification_announcements": notification_count,
            "total_announcements": legacy_count + notification_count,
            "user_counts": user_counts,
            "migration_progress": {
                "legacy_percentage": (legacy_count / max(legacy_count + notification_count, 1)) * 100,
                "notification_percentage": (notification_count / max(legacy_count + notification_count, 1)) * 100
            },
            "timestamp": datetime.utcnow().isoformat()
        }

    async def health_check(self) -> Dict[str, Any]:
        """Health check for compatibility layer"""
        
        try:
            # Test database connectivity
            test_count = await self.db.scalar(select(func.count(User.id)))
            
            # Test notification service
            unread_count = await self.notification_service.get_unread_count(1)  # Test with user ID 1
            
            return {
                "status": "healthy",
                "database_connection": "ok",
                "notification_service": "ok",
                "user_count": test_count,
                "timestamp": datetime.utcnow().isoformat()
            }
        except Exception as e:
            logger.error(f"Compatibility layer health check failed: {str(e)}")
            return {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.utcnow().isoformat()
            }