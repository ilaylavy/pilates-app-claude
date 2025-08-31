import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from ....api.v1.deps import get_current_active_user, get_admin_user, get_db, get_redis
from ....models.user import User
from ....models.notification import NotificationType
from ....schemas.notification import (
    NotificationResponse,
    NotificationPaginationResponse,
    NotificationUnreadCount,
    NotificationMarkRead,
    NotificationCreate,
    NotificationBulkCreate,
    NotificationBroadcast,
    NotificationRenderRequest,
    NotificationRenderResponse,
    NotificationError
)
from ....services.notification_service import (
    NotificationService, 
    NotificationError as ServiceNotificationError,
    NotificationQuotaExceeded,
    InvalidNotificationType,
    NotificationValidationError
)
from ....services.notification_template_service import NotificationTemplateService

logger = logging.getLogger("notification_api")
router = APIRouter()


# Error handler
def handle_notification_error(e: Exception) -> HTTPException:
    """Convert service exceptions to HTTP exceptions"""
    if isinstance(e, NotificationQuotaExceeded):
        return HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(e)
        )
    elif isinstance(e, NotificationValidationError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    elif isinstance(e, InvalidNotificationType):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    elif isinstance(e, ServiceNotificationError):
        return HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    else:
        logger.error(f"Unexpected error in notification API: {str(e)}")
        return HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Internal server error"
        )


# User notification endpoints
@router.get("/", response_model=NotificationPaginationResponse)
async def get_user_notifications(
    skip: int = Query(0, ge=0, description="Number of notifications to skip"),
    limit: int = Query(50, ge=1, le=100, description="Maximum number of notifications to return"),
    unread_only: bool = Query(False, description="Return only unread notifications"),
    types: Optional[List[NotificationType]] = Query(None, description="Filter by notification types"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """
    Get paginated notifications for current user.
    
    Query parameters:
    - skip: Number of notifications to skip (for pagination)
    - limit: Maximum number to return (1-100)
    - unread_only: If true, only return unread notifications
    - types: Filter by specific notification types
    """
    try:
        notification_service = NotificationService(db, redis_client)
        
        logger.info(f"Fetching notifications for user {current_user.id}, skip={skip}, limit={limit}")
        
        result = await notification_service.get_user_notifications(
            user_id=current_user.id,
            skip=skip,
            limit=limit,
            unread_only=unread_only,
            types=types
        )
        
        return NotificationPaginationResponse(
            notifications=[NotificationResponse(**notif) for notif in result.notifications],
            pagination=result.pagination,
            unread_count=result.unread_count
        )
        
    except Exception as e:
        raise handle_notification_error(e)


@router.get("/unread-count", response_model=NotificationUnreadCount)
async def get_unread_count(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Get count of unread notifications for current user."""
    try:
        notification_service = NotificationService(db, redis_client)
        
        count = await notification_service.get_unread_count(current_user.id)
        
        return NotificationUnreadCount(count=count)
        
    except Exception as e:
        raise handle_notification_error(e)


@router.post("/{notification_id}/mark-read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Mark a single notification as read."""
    try:
        notification_service = NotificationService(db, redis_client)
        
        success = await notification_service.mark_as_read(notification_id, current_user.id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found or does not belong to current user"
            )
        
        return {"message": "Notification marked as read"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise handle_notification_error(e)


@router.post("/bulk-mark-read")
async def bulk_mark_notifications_read(
    mark_read_request: NotificationMarkRead,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Mark multiple notifications as read."""
    try:
        notification_service = NotificationService(db, redis_client)
        
        marked_count = await notification_service.bulk_mark_read(
            mark_read_request.notification_ids, 
            current_user.id
        )
        
        return {
            "message": f"Marked {marked_count} notifications as read",
            "marked_count": marked_count,
            "total_requested": len(mark_read_request.notification_ids)
        }
        
    except Exception as e:
        raise handle_notification_error(e)


@router.delete("/{notification_id}")
async def dismiss_notification(
    notification_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Dismiss (soft delete) a notification for current user."""
    try:
        notification_service = NotificationService(db, redis_client)
        
        success = await notification_service.mark_as_dismissed(notification_id, current_user.id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Notification not found or does not belong to current user"
            )
        
        return {"message": "Notification dismissed"}
        
    except HTTPException:
        raise
    except Exception as e:
        raise handle_notification_error(e)


# Admin notification endpoints
@router.post("/create", dependencies=[Depends(get_admin_user)])
async def create_notification(
    notification_data: NotificationCreate,
    request: Request,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Create a single notification (admin only)."""
    try:
        notification_service = NotificationService(db, redis_client)
        
        notification = await notification_service.create_notification(
            user_id=notification_data.user_id,
            notification_type=notification_data.type,
            title=notification_data.title,
            body=notification_data.body,
            data=notification_data.data,
            priority=notification_data.priority,
            expires_at=notification_data.expires_at,
            sender_id=current_user.id,
            source_type=notification_data.source_type,
            source_id=notification_data.source_id,
            extra_data=notification_data.extra_data
        )
        
        # Log admin action
        logger.info(f"Admin {current_user.id} created notification {notification.id} for user {notification_data.user_id}")
        
        return {"message": "Notification created", "notification_id": notification.id}
        
    except Exception as e:
        raise handle_notification_error(e)


@router.post("/create-bulk", dependencies=[Depends(get_admin_user)])
async def create_bulk_notifications(
    notification_data: NotificationBulkCreate,
    request: Request,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Create notifications for multiple users (admin only)."""
    try:
        notification_service = NotificationService(db, redis_client)
        
        notifications = await notification_service.create_bulk_notifications(
            user_ids=notification_data.user_ids,
            notification_type=notification_data.type,
            title=notification_data.title,
            body=notification_data.body,
            data=notification_data.data,
            priority=notification_data.priority,
            expires_at=notification_data.expires_at,
            sender_id=current_user.id,
            source_type=notification_data.source_type,
            source_id=notification_data.source_id,
            extra_data=notification_data.extra_data
        )
        
        logger.info(f"Admin {current_user.id} created {len(notifications)} bulk notifications")
        
        return {
            "message": f"Created {len(notifications)} notifications",
            "notifications_created": len(notifications),
            "target_users": len(notification_data.user_ids)
        }
        
    except Exception as e:
        raise handle_notification_error(e)


@router.post("/broadcast", dependencies=[Depends(get_admin_user)])
async def create_broadcast_notification(
    notification_data: NotificationBroadcast,
    request: Request,
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Create broadcast notification for users with specific roles (admin only)."""
    try:
        from ....models.user import UserRole
        
        notification_service = NotificationService(db, redis_client)
        
        # Convert role strings to UserRole enums
        target_roles = [UserRole(role) for role in notification_data.target_roles]
        
        notifications = await notification_service.create_broadcast_notification(
            target_roles=target_roles,
            notification_type=notification_data.type,
            title=notification_data.title,
            body=notification_data.body,
            data=notification_data.data,
            priority=notification_data.priority,
            expires_at=notification_data.expires_at,
            sender_id=current_user.id,
            source_type=notification_data.source_type,
            source_id=notification_data.source_id,
            extra_data=notification_data.extra_data
        )
        
        logger.info(f"Admin {current_user.id} created broadcast notification for {len(notifications)} users")
        
        return {
            "message": f"Broadcast notification created for {len(notifications)} users",
            "notifications_created": len(notifications),
            "target_roles": notification_data.target_roles
        }
        
    except Exception as e:
        raise handle_notification_error(e)


# Template endpoints
@router.post("/render-template", response_model=NotificationRenderResponse)
async def render_notification_template(
    render_request: NotificationRenderRequest,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Render a notification template with variables."""
    try:
        template_service = NotificationTemplateService(db)
        
        result = await template_service.render_notification(
            notification_type=render_request.notification_type,
            language=render_request.language,
            **render_request.variables
        )
        
        return NotificationRenderResponse(**result)
        
    except Exception as e:
        raise handle_notification_error(e)


# Utility endpoints
@router.get("/types")
async def get_notification_types(
    current_user: User = Depends(get_current_active_user)
):
    """Get list of available notification types."""
    return {
        "notification_types": [
            {
                "value": nt.value,
                "name": nt.value.replace("_", " ").title()
            }
            for nt in NotificationType
        ]
    }


@router.post("/cleanup", dependencies=[Depends(get_admin_user)])
async def cleanup_old_notifications(
    days: int = Query(30, ge=1, le=365, description="Age in days for notifications to cleanup"),
    current_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Cleanup old notifications (admin only)."""
    try:
        notification_service = NotificationService(db, redis_client)
        
        result = await notification_service.cleanup_old_notifications(days)
        
        logger.info(f"Admin {current_user.id} triggered notification cleanup: {result}")
        
        return {
            "message": "Cleanup completed successfully",
            "cleanup_stats": result
        }
        
    except Exception as e:
        raise handle_notification_error(e)