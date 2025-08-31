"""
Email management endpoints for testing and configuration
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from ....core.deps import get_db, get_admin_user, get_redis
from ....models.user import User, UserRole
from ....models.notification import NotificationType, NotificationPriority
from ....schemas.notification import NotificationCreate
from ....services.email_service import EmailService, EmailResult
from ....services.notification_service import NotificationService
from pydantic import BaseModel, EmailStr

router = APIRouter()

class EmailTestRequest(BaseModel):
    template_type: str
    language: str = 'en'
    to_email: Optional[EmailStr] = None

class EmailQuotaResponse(BaseModel):
    total_remaining: int
    total_quota: int
    used_today: int
    by_priority: Dict[str, int]

class EmailStatsResponse(BaseModel):
    quota: EmailQuotaResponse
    queue_status: Dict[str, int]
    recent_deliveries: List[Dict[str, Any]]

@router.get("/quota", response_model=EmailQuotaResponse)
async def get_email_quota(
    admin_user: User = Depends(get_admin_user),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Get current email quota usage and remaining quota"""
    email_service = EmailService(redis_client)
    quota_status = await email_service.get_quota_status()
    
    return EmailQuotaResponse(**quota_status)

@router.get("/stats", response_model=EmailStatsResponse)
async def get_email_stats(
    admin_user: User = Depends(get_admin_user),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Get comprehensive email service statistics"""
    email_service = EmailService(redis_client)
    
    quota_status = await email_service.get_quota_status()
    
    # Get queue lengths
    queue_status = {
        "regular_queue": await redis_client.llen("email_queue") if redis_client else 0,
        "tomorrow_queue": await redis_client.zcard("email_queue_tomorrow") if redis_client else 0,
        "processing": 0  # TODO: Add processing queue count
    }
    
    # TODO: Add recent delivery stats from database
    recent_deliveries = []
    
    return EmailStatsResponse(
        quota=EmailQuotaResponse(**quota_status),
        queue_status=queue_status,
        recent_deliveries=recent_deliveries
    )

@router.post("/test", status_code=200)
async def send_test_email(
    test_request: EmailTestRequest,
    admin_user: User = Depends(get_admin_user),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Send a test email to verify templates and configuration"""
    
    email_service = EmailService(redis_client)
    
    # Use admin's email if not specified
    to_email = test_request.to_email or admin_user.email
    
    if not to_email:
        raise HTTPException(
            status_code=400,
            detail="No email address specified and admin user has no email"
        )
    
    # Validate template type
    valid_templates = [
        'booking_confirmation',
        'booking_cancellation',
        'payment_failure',
        'generic_notification'
    ]
    
    if test_request.template_type not in valid_templates:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid template type. Valid options: {valid_templates}"
        )
    
    try:
        result = await email_service.send_test_email(
            to_email=str(to_email),
            template_type=test_request.template_type,
            language=test_request.language
        )
        
        if result.status.value == "failed":
            raise HTTPException(status_code=500, detail=result.error)
        
        return {
            "status": "success",
            "message": f"Test email sent to {to_email}",
            "template": test_request.template_type,
            "language": test_request.language,
            "result": {
                "status": result.status.value,
                "message_id": result.message_id
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/send-notification", status_code=200)
async def send_notification_email(
    notification_data: NotificationCreate,
    user_id: int,
    language: str = 'en',
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Send a notification as email to specific user (admin only)"""
    
    # Get target user
    from sqlalchemy import select
    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    target_user = result.scalar_one_or_none()
    
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not target_user.email:
        raise HTTPException(status_code=400, detail="User has no email address")
    
    try:
        # Create notification first
        notification_service = NotificationService(db, redis_client)
        notification = await notification_service.create_notification(
            user_id=user_id,
            notification_type=notification_data.type,
            title=notification_data.title,
            body=notification_data.body,
            data=notification_data.data,
            priority=notification_data.priority,
            sender_id=admin_user.id
        )
        
        # Send as email
        email_service = EmailService(redis_client)
        email_result = await email_service.send_notification_email(
            user=target_user,
            notification=notification,
            language=language
        )
        
        return {
            "status": "success",
            "notification_id": notification.id,
            "email_result": {
                "status": email_result.status.value,
                "message_id": email_result.message_id,
                "error": email_result.error,
                "queued_until": email_result.queued_until.isoformat() if email_result.queued_until else None
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/process-queue", status_code=200)
async def process_email_queue(
    batch_size: int = 10,
    background_tasks: BackgroundTasks = BackgroundTasks(),
    admin_user: User = Depends(get_admin_user),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Process queued emails (admin only)"""
    
    email_service = EmailService(redis_client)
    
    # Process in background
    async def process_queue():
        return await email_service.process_queued_emails(batch_size)
    
    background_tasks.add_task(process_queue)
    
    return {
        "status": "processing",
        "message": f"Started processing up to {batch_size} queued emails",
        "batch_size": batch_size
    }

@router.get("/templates", status_code=200)
async def list_email_templates(
    admin_user: User = Depends(get_admin_user)
):
    """List available email templates"""
    
    templates = {
        "booking_confirmation": {
            "name": "Booking Confirmation",
            "description": "Sent when a booking is successfully created",
            "languages": ["en", "he"],
            "priority": "normal"
        },
        "booking_cancellation": {
            "name": "Booking Cancellation", 
            "description": "Sent when a booking is cancelled",
            "languages": ["en", "he"],
            "priority": "high"
        },
        "payment_failure": {
            "name": "Payment Failure",
            "description": "Sent when a payment fails",
            "languages": ["en", "he"],
            "priority": "critical"
        },
        "generic_notification": {
            "name": "Generic Notification",
            "description": "Fallback template for other notification types",
            "languages": ["en", "he"],
            "priority": "variable"
        }
    }
    
    return {
        "templates": templates,
        "total_count": len(templates),
        "supported_languages": ["en", "he"]
    }

@router.post("/clear-queue", status_code=200)
async def clear_email_queue(
    queue_type: str = "all",  # "all", "regular", "tomorrow"
    admin_user: User = Depends(get_admin_user),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Clear email queues (admin only - use with caution)"""
    
    if not redis_client:
        raise HTTPException(status_code=503, detail="Redis unavailable")
    
    cleared_counts = {}
    
    try:
        if queue_type in ["all", "regular"]:
            regular_count = await redis_client.llen("email_queue")
            await redis_client.delete("email_queue")
            cleared_counts["regular"] = regular_count
        
        if queue_type in ["all", "tomorrow"]:
            tomorrow_count = await redis_client.zcard("email_queue_tomorrow")
            await redis_client.delete("email_queue_tomorrow")
            cleared_counts["tomorrow"] = tomorrow_count
            
        return {
            "status": "success",
            "message": "Email queues cleared",
            "cleared_counts": cleared_counts
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))