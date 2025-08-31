import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple, Set
from dataclasses import dataclass

from sqlalchemy import select, func, and_, or_, desc
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import redis.asyncio as redis

from ..models.notification import (
    Notification, 
    NotificationRead, 
    NotificationPreference, 
    NotificationTemplate,
    NotificationType,
    NotificationPriority
)
from ..models.user import User, UserRole
from ..core.config import settings

# Configure logging
logger = logging.getLogger("notifications")

# Business rule constants (your enhancement #3)
MAX_TITLE_LENGTH = 200
MAX_BODY_LENGTH = 1000
MAX_NOTIFICATIONS_PER_HOUR = 50  # Rate limiting per user
CLEANUP_DAYS_DEFAULT = 30
CLEANUP_DAYS_CRITICAL = 90

# Priority mapping for auto-assignment (your enhancement #3)
PRIORITY_MAPPING = {
    NotificationType.PAYMENT_FAILED: NotificationPriority.CRITICAL,
    NotificationType.SYSTEM_MAINTENANCE: NotificationPriority.CRITICAL,
    NotificationType.BOOKING_CANCELLED: NotificationPriority.HIGH,
    NotificationType.URGENT_ANNOUNCEMENT: NotificationPriority.HIGH,
    NotificationType.WAITLIST_PROMOTED: NotificationPriority.HIGH,
    NotificationType.BOOKING_SUCCESS: NotificationPriority.NORMAL,
    NotificationType.PACKAGE_ACTIVATED: NotificationPriority.NORMAL,
    NotificationType.CLASS_REMINDER: NotificationPriority.NORMAL,
    NotificationType.ADMIN_ANNOUNCEMENT: NotificationPriority.NORMAL,
    NotificationType.GENERAL_ANNOUNCEMENT: NotificationPriority.LOW,
    NotificationType.ACCOUNT_VERIFIED: NotificationPriority.LOW,
}


# Custom exceptions (your enhancement #5)
class NotificationError(Exception):
    """Base notification error"""
    pass


class NotificationQuotaExceeded(NotificationError):
    """User has exceeded notification rate limit"""
    pass


class InvalidNotificationType(NotificationError):
    """Invalid notification type provided"""
    pass


class NotificationValidationError(NotificationError):
    """Notification content validation failed"""
    pass


@dataclass
class NotificationResponse:
    """Structured response for API endpoints"""
    notifications: List[Dict[str, Any]]
    pagination: Dict[str, Any]
    unread_count: int


class NotificationService:
    """Core notification service with comprehensive features"""

    def __init__(self, db: AsyncSession, redis_client: Optional[redis.Redis] = None):
        self.db = db
        self.redis = redis_client

    def _validate_notification_content(self, title: str, body: str) -> None:
        """Validate notification content (your enhancement #5)"""
        if not title or len(title.strip()) == 0:
            raise NotificationValidationError("Title cannot be empty")
        
        if len(title) > MAX_TITLE_LENGTH:
            raise NotificationValidationError(f"Title exceeds {MAX_TITLE_LENGTH} characters")
        
        if not body or len(body.strip()) == 0:
            raise NotificationValidationError("Body cannot be empty")
        
        if len(body) > MAX_BODY_LENGTH:
            raise NotificationValidationError(f"Body exceeds {MAX_BODY_LENGTH} characters")

    async def _check_rate_limit(self, user_id: int) -> None:
        """Check user rate limiting (your enhancement #3)"""
        if not self.redis:
            return  # Skip if Redis not available

        rate_key = f"notification_rate:{user_id}"
        current_count = await self.redis.get(rate_key)
        
        if current_count and int(current_count) >= MAX_NOTIFICATIONS_PER_HOUR:
            raise NotificationQuotaExceeded(
                f"User {user_id} exceeded {MAX_NOTIFICATIONS_PER_HOUR} notifications per hour"
            )
        
        # Increment counter with 1-hour expiry
        await self.redis.incr(rate_key)
        await self.redis.expire(rate_key, 3600)

    async def _validate_user_exists(self, user_id: int) -> User:
        """Validate user exists and is active (your enhancement #5)"""
        stmt = select(User).where(User.id == user_id, User.is_active == True)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise NotificationValidationError(f"User {user_id} not found or inactive")
        
        return user

    def _auto_assign_priority(self, notification_type: NotificationType) -> NotificationPriority:
        """Auto-assign priority based on type (your enhancement #3)"""
        return PRIORITY_MAPPING.get(notification_type, NotificationPriority.NORMAL)

    async def create_notification(
        self,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        priority: Optional[NotificationPriority] = None,
        expires_at: Optional[datetime] = None,
        sender_id: Optional[int] = None,
        source_type: Optional[str] = None,
        source_id: Optional[int] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> Notification:
        """Create single notification with comprehensive validation"""
        
        logger.info(f"Creating notification type={notification_type} for user={user_id}")
        
        try:
            # Validation
            self._validate_notification_content(title, body)
            await self._validate_user_exists(user_id)
            await self._check_rate_limit(user_id)
            
            # Auto-assign priority if not provided
            if priority is None:
                priority = self._auto_assign_priority(notification_type)
            
            # Create notification
            notification = Notification(
                user_id=user_id,
                type=notification_type,
                title=title.strip(),
                body=body.strip(),
                data_json=data,
                priority=priority,
                expires_at=expires_at,
                sender_id=sender_id,
                source_type=source_type,
                source_id=source_id,
                extra_data=extra_data,
                is_broadcast=False
            )
            
            self.db.add(notification)
            await self.db.commit()
            await self.db.refresh(notification)
            
            logger.info(f"Notification created: id={notification.id}")
            return notification
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create notification: {str(e)}")
            raise

    async def create_bulk_notifications(
        self,
        user_ids: List[int],
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        priority: Optional[NotificationPriority] = None,
        expires_at: Optional[datetime] = None,
        sender_id: Optional[int] = None,
        source_type: Optional[str] = None,
        source_id: Optional[int] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> List[Notification]:
        """Create notifications for multiple users efficiently"""
        
        logger.info(f"Creating bulk notifications type={notification_type} for {len(user_ids)} users")
        
        try:
            # Validation
            self._validate_notification_content(title, body)
            
            if not user_ids:
                raise NotificationValidationError("User IDs list cannot be empty")
            
            # Auto-assign priority
            if priority is None:
                priority = self._auto_assign_priority(notification_type)
            
            # Validate all users exist (batch query)
            stmt = select(User.id).where(User.id.in_(user_ids), User.is_active == True)
            result = await self.db.execute(stmt)
            valid_user_ids = {row[0] for row in result.fetchall()}
            
            invalid_users = set(user_ids) - valid_user_ids
            if invalid_users:
                logger.warning(f"Invalid user IDs filtered out: {invalid_users}")
            
            # Create notifications in batch
            notifications = []
            for user_id in valid_user_ids:
                notification = Notification(
                    user_id=user_id,
                    type=notification_type,
                    title=title.strip(),
                    body=body.strip(),
                    data_json=data,
                    priority=priority,
                    expires_at=expires_at,
                    sender_id=sender_id,
                    source_type=source_type,
                    source_id=source_id,
                    extra_data=extra_data,
                    is_broadcast=False
                )
                notifications.append(notification)
            
            self.db.add_all(notifications)
            await self.db.commit()
            
            logger.info(f"Bulk notifications created: count={len(notifications)}")
            return notifications
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create bulk notifications: {str(e)}")
            raise

    async def create_broadcast_notification(
        self,
        target_roles: List[UserRole],
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        priority: Optional[NotificationPriority] = None,
        expires_at: Optional[datetime] = None,
        sender_id: Optional[int] = None,
        source_type: Optional[str] = None,
        source_id: Optional[int] = None,
        extra_data: Optional[Dict[str, Any]] = None
    ) -> List[Notification]:
        """Create broadcast notification for users with specific roles"""
        
        logger.info(f"Creating broadcast notification type={notification_type} for roles={target_roles}")
        
        try:
            # Get all active users with target roles
            stmt = select(User.id).where(
                User.role.in_(target_roles),
                User.is_active == True
            )
            result = await self.db.execute(stmt)
            user_ids = [row[0] for row in result.fetchall()]
            
            if not user_ids:
                logger.warning(f"No users found with roles {target_roles}")
                return []
            
            # Create bulk notifications marked as broadcast
            notifications = await self.create_bulk_notifications(
                user_ids=user_ids,
                notification_type=notification_type,
                title=title,
                body=body,
                data=data,
                priority=priority,
                expires_at=expires_at,
                sender_id=sender_id,
                source_type=source_type,
                source_id=source_id,
                extra_data={**(extra_data or {}), "is_broadcast": True, "target_roles": [role.value for role in target_roles]}
            )
            
            # Mark as broadcast
            for notification in notifications:
                notification.is_broadcast = True
            
            await self.db.commit()
            
            logger.info(f"Broadcast notification created for {len(notifications)} users")
            return notifications
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create broadcast notification: {str(e)}")
            raise

    async def get_user_notifications(
        self,
        user_id: int,
        skip: int = 0,
        limit: int = 50,
        unread_only: bool = False,
        types: Optional[List[NotificationType]] = None
    ) -> NotificationResponse:
        """Get paginated notifications for user with read status (your enhancement #8)"""
        
        logger.debug(f"Fetching notifications for user={user_id}, skip={skip}, limit={limit}")
        
        # Build base query
        stmt = (
            select(Notification)
            .options(selectinload(Notification.notification_reads))
            .where(
                Notification.user_id == user_id,
                Notification.deleted_at.is_(None),
                Notification.archived_at.is_(None),
                or_(
                    Notification.expires_at.is_(None),
                    Notification.expires_at > func.now()
                )
            )
            .order_by(desc(Notification.created_at))
        )
        
        # Apply filters
        if types:
            stmt = stmt.where(Notification.type.in_(types))
        
        if unread_only:
            # Complex subquery to find unread notifications
            read_subquery = (
                select(NotificationRead.notification_id)
                .where(
                    NotificationRead.user_id == user_id,
                    NotificationRead.read_at.is_not(None)
                )
            )
            stmt = stmt.where(~Notification.id.in_(read_subquery))
        
        # Get total count for pagination
        count_stmt = select(func.count()).select_from(stmt.subquery())
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar()
        
        # Get paginated results
        paginated_stmt = stmt.offset(skip).limit(limit)
        result = await self.db.execute(paginated_stmt)
        notifications = result.scalars().all()
        
        # Get unread count
        unread_count = await self.get_unread_count(user_id)
        
        # Format response
        notification_data = []
        for notification in notifications:
            is_read = notification.is_read_by_user(user_id)
            is_dismissed = notification.is_dismissed_by_user(user_id)
            
            notification_data.append({
                "id": notification.id,
                "type": notification.type.value,
                "title": notification.title,
                "body": notification.body,
                "data": notification.data_json,
                "priority": notification.priority.value,
                "created_at": notification.created_at.isoformat(),
                "expires_at": notification.expires_at.isoformat() if notification.expires_at else None,
                "source_type": notification.source_type,
                "source_id": notification.source_id,
                "extra_data": notification.extra_data,
                "is_broadcast": notification.is_broadcast,
                "is_read": is_read,
                "is_dismissed": is_dismissed
            })
        
        return NotificationResponse(
            notifications=notification_data,
            pagination={
                "total": total,
                "skip": skip,
                "limit": limit,
                "has_more": skip + limit < total
            },
            unread_count=unread_count
        )

    async def get_unread_count(self, user_id: int) -> int:
        """Get count of unread notifications for user"""
        
        # Subquery for read notification IDs
        read_subquery = (
            select(NotificationRead.notification_id)
            .where(
                NotificationRead.user_id == user_id,
                NotificationRead.read_at.is_not(None)
            )
        )
        
        # Count unread notifications
        stmt = (
            select(func.count(Notification.id))
            .where(
                Notification.user_id == user_id,
                Notification.deleted_at.is_(None),
                Notification.archived_at.is_(None),
                or_(
                    Notification.expires_at.is_(None),
                    Notification.expires_at > func.now()
                ),
                ~Notification.id.in_(read_subquery)
            )
        )
        
        result = await self.db.execute(stmt)
        return result.scalar() or 0

    async def mark_as_read(self, notification_id: int, user_id: int) -> bool:
        """Mark single notification as read"""
        
        logger.debug(f"Marking notification {notification_id} as read for user {user_id}")
        
        try:
            # Check if notification belongs to user
            stmt = select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
            result = await self.db.execute(stmt)
            notification = result.scalar_one_or_none()
            
            if not notification:
                logger.warning(f"Notification {notification_id} not found for user {user_id}")
                return False
            
            # Create or update read record
            read_stmt = select(NotificationRead).where(
                NotificationRead.notification_id == notification_id,
                NotificationRead.user_id == user_id
            )
            read_result = await self.db.execute(read_stmt)
            read_record = read_result.scalar_one_or_none()
            
            if read_record:
                if read_record.read_at is None:
                    read_record.read_at = func.now()
            else:
                read_record = NotificationRead(
                    notification_id=notification_id,
                    user_id=user_id,
                    read_at=func.now()
                )
                self.db.add(read_record)
            
            await self.db.commit()
            logger.debug(f"Notification {notification_id} marked as read")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to mark notification as read: {str(e)}")
            raise

    async def mark_as_dismissed(self, notification_id: int, user_id: int) -> bool:
        """Mark notification as dismissed (soft delete for user)"""
        
        logger.debug(f"Dismissing notification {notification_id} for user {user_id}")
        
        try:
            # Check if notification belongs to user
            stmt = select(Notification).where(
                Notification.id == notification_id,
                Notification.user_id == user_id
            )
            result = await self.db.execute(stmt)
            notification = result.scalar_one_or_none()
            
            if not notification:
                return False
            
            # Create or update read record with dismissal
            read_stmt = select(NotificationRead).where(
                NotificationRead.notification_id == notification_id,
                NotificationRead.user_id == user_id
            )
            read_result = await self.db.execute(read_stmt)
            read_record = read_result.scalar_one_or_none()
            
            if read_record:
                read_record.dismissed_at = func.now()
                if read_record.read_at is None:
                    read_record.read_at = func.now()
            else:
                read_record = NotificationRead(
                    notification_id=notification_id,
                    user_id=user_id,
                    read_at=func.now(),
                    dismissed_at=func.now()
                )
                self.db.add(read_record)
            
            await self.db.commit()
            logger.debug(f"Notification {notification_id} dismissed")
            return True
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to dismiss notification: {str(e)}")
            raise

    async def bulk_mark_read(self, notification_ids: List[int], user_id: int) -> int:
        """Mark multiple notifications as read"""
        
        logger.debug(f"Bulk marking {len(notification_ids)} notifications as read for user {user_id}")
        
        try:
            marked_count = 0
            
            for notification_id in notification_ids:
                success = await self.mark_as_read(notification_id, user_id)
                if success:
                    marked_count += 1
            
            logger.info(f"Bulk marked {marked_count}/{len(notification_ids)} notifications as read")
            return marked_count
            
        except Exception as e:
            logger.error(f"Failed to bulk mark notifications as read: {str(e)}")
            raise

    async def cleanup_old_notifications(self, days: int = CLEANUP_DAYS_DEFAULT) -> Dict[str, int]:
        """Cleanup old notifications with different retention for critical ones (your enhancement #7)"""
        
        logger.info(f"Starting notification cleanup (>{days} days old)")
        
        try:
            cutoff_date = datetime.utcnow() - timedelta(days=days)
            critical_cutoff_date = datetime.utcnow() - timedelta(days=CLEANUP_DAYS_CRITICAL)
            
            # Archive normal notifications
            archive_stmt = (
                select(Notification)
                .where(
                    Notification.created_at < cutoff_date,
                    Notification.priority != NotificationPriority.CRITICAL,
                    Notification.archived_at.is_(None),
                    Notification.deleted_at.is_(None)
                )
            )
            archive_result = await self.db.execute(archive_stmt)
            archive_notifications = archive_result.scalars().all()
            
            archived_count = 0
            for notification in archive_notifications:
                notification.archived_at = func.now()
                archived_count += 1
            
            # Archive critical notifications (longer retention)
            critical_archive_stmt = (
                select(Notification)
                .where(
                    Notification.created_at < critical_cutoff_date,
                    Notification.priority == NotificationPriority.CRITICAL,
                    Notification.archived_at.is_(None),
                    Notification.deleted_at.is_(None)
                )
            )
            critical_result = await self.db.execute(critical_archive_stmt)
            critical_notifications = critical_result.scalars().all()
            
            critical_archived_count = 0
            for notification in critical_notifications:
                notification.archived_at = func.now()
                critical_archived_count += 1
            
            await self.db.commit()
            
            cleanup_stats = {
                "archived_normal": archived_count,
                "archived_critical": critical_archived_count,
                "total_archived": archived_count + critical_archived_count
            }
            
            logger.info(f"Notification cleanup completed: {cleanup_stats}")
            return cleanup_stats
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to cleanup notifications: {str(e)}")
            raise