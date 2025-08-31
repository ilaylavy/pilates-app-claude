"""
Notification testing endpoints for verifying end-to-end flow
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
from datetime import datetime, timezone

from ....core.deps import get_db, get_current_user, get_admin_user, get_redis
from ....models.user import User
from ....models.notification import NotificationType, NotificationPriority
from ....services.notification_routing_service import NotificationRoutingService
from ....services.email_service import EmailService
from ....services.push_notification_service import PushNotificationService
from ....services.device_token_service import DeviceTokenService
from pydantic import BaseModel

router = APIRouter()

class NotificationTestRequest(BaseModel):
    notification_type: NotificationType
    title: str
    body: str
    data: Optional[Dict[str, Any]] = None
    priority: Optional[NotificationPriority] = None
    language: str = 'en'
    force_channels: Optional[List[str]] = None

class EndToEndTestResult(BaseModel):
    test_name: str
    user_id: int
    notification_id: int
    channels_attempted: List[str]
    channels_successful: List[str] 
    channels_failed: List[str]
    total_delivered: int
    channel_details: List[Dict[str, Any]]
    test_status: str
    error: Optional[str] = None

@router.post("/test-booking-flow", response_model=EndToEndTestResult)
async def test_booking_notification_flow(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Test complete booking notification flow"""
    
    routing_service = NotificationRoutingService(db, redis_client)
    
    try:
        # Simulate booking success notification
        routing_result = await routing_service.create_and_route_notification(
            user_id=current_user.id,
            notification_type=NotificationType.BOOKING_SUCCESS,
            title="Test Booking Confirmed! 🎉",
            body="This is a test booking confirmation to verify the notification system works.",
            data={
                "booking_id": 99999,
                "class_instance_id": 99999,
                "class_name": "Test Morning Flow Class",
                "class_date": "2024-12-01",
                "class_time": "09:00",
                "instructor_name": "Test Instructor",
                "status": "confirmed",
                "action_url": "/classes/99999",
                "calendar_url": "/calendar/add/99999"
            },
            language='en'
        )
        
        return EndToEndTestResult(
            test_name="booking_success_flow",
            user_id=current_user.id,
            notification_id=routing_result.notification_id,
            channels_attempted=routing_result.channels_attempted,
            channels_successful=routing_result.channels_successful,
            channels_failed=routing_result.channels_failed,
            total_delivered=routing_result.total_delivered,
            channel_details=routing_result.channel_results,
            test_status="success" if routing_result.total_delivered > 0 else "partial_failure"
        )
        
    except Exception as e:
        return EndToEndTestResult(
            test_name="booking_success_flow",
            user_id=current_user.id,
            notification_id=0,
            channels_attempted=[],
            channels_successful=[],
            channels_failed=["all"],
            total_delivered=0,
            channel_details=[],
            test_status="failed",
            error=str(e)
        )

@router.post("/test-payment-failure-flow", response_model=EndToEndTestResult)
async def test_payment_failure_notification_flow(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Test CRITICAL payment failure notification flow"""
    
    routing_service = NotificationRoutingService(db, redis_client)
    
    try:
        # Simulate CRITICAL payment failure notification
        routing_result = await routing_service.create_and_route_notification(
            user_id=current_user.id,
            notification_type=NotificationType.PAYMENT_FAILED,
            title="Test Payment Failed ⚠️",
            body="This is a test payment failure notification to verify CRITICAL priority routing works.",
            data={
                "payment_id": 99999,
                "amount": 100.00,
                "currency": "USD",
                "failure_reason": "Test failure - card declined",
                "card_last4": "4242",
                "error_code": "card_declined",
                "retry_payment_url": "/payments/retry/99999",
                "update_card_url": "/payments/methods",
                "attempt_date": datetime.now(timezone.utc).isoformat()
            },
            language='en',
            # Force all channels for CRITICAL priority
            force_channels=["email", "push", "in_app"]
        )
        
        return EndToEndTestResult(
            test_name="payment_failure_critical_flow",
            user_id=current_user.id,
            notification_id=routing_result.notification_id,
            channels_attempted=routing_result.channels_attempted,
            channels_successful=routing_result.channels_successful,
            channels_failed=routing_result.channels_failed,
            total_delivered=routing_result.total_delivered,
            channel_details=routing_result.channel_results,
            test_status="success" if routing_result.total_delivered > 0 else "partial_failure"
        )
        
    except Exception as e:
        return EndToEndTestResult(
            test_name="payment_failure_critical_flow",
            user_id=current_user.id,
            notification_id=0,
            channels_attempted=[],
            channels_successful=[],
            channels_failed=["all"],
            total_delivered=0,
            channel_details=[],
            test_status="failed",
            error=str(e)
        )

@router.post("/test-custom-notification", response_model=EndToEndTestResult)
async def test_custom_notification(
    test_request: NotificationTestRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Test custom notification with specified parameters"""
    
    routing_service = NotificationRoutingService(db, redis_client)
    
    try:
        routing_result = await routing_service.create_and_route_notification(
            user_id=current_user.id,
            notification_type=test_request.notification_type,
            title=test_request.title,
            body=test_request.body,
            data=test_request.data,
            language=test_request.language,
            force_channels=test_request.force_channels
        )
        
        return EndToEndTestResult(
            test_name=f"custom_{test_request.notification_type.value}",
            user_id=current_user.id,
            notification_id=routing_result.notification_id,
            channels_attempted=routing_result.channels_attempted,
            channels_successful=routing_result.channels_successful,
            channels_failed=routing_result.channels_failed,
            total_delivered=routing_result.total_delivered,
            channel_details=routing_result.channel_results,
            test_status="success" if routing_result.total_delivered > 0 else "partial_failure"
        )
        
    except Exception as e:
        return EndToEndTestResult(
            test_name=f"custom_{test_request.notification_type.value}",
            user_id=current_user.id,
            notification_id=0,
            channels_attempted=[],
            channels_successful=[],
            channels_failed=["all"],
            total_delivered=0,
            channel_details=[],
            test_status="failed",
            error=str(e)
        )

@router.get("/system-status")
async def get_notification_system_status(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Get complete notification system status"""
    
    # Check email service
    email_service = EmailService(redis_client)
    email_quota = await email_service.get_quota_status()
    
    # Check push service
    push_service = PushNotificationService(db, redis_client)
    push_config = push_service.get_config_status()
    
    # Check device tokens
    device_service = DeviceTokenService(db, redis_client)
    user_android_tokens = await device_service.get_android_tokens(current_user.id)
    user_ios_tokens = await device_service.get_ios_tokens(current_user.id)
    device_stats = await device_service.get_token_stats()
    
    # Check routing service
    routing_service = NotificationRoutingService(db, redis_client)
    routing_stats = await routing_service.get_routing_stats()
    
    return {
        "user_id": current_user.id,
        "user_email": current_user.email,
        "system_status": {
            "email": {
                "enabled": email_service.enabled,
                "quota_remaining": email_quota.get("total_remaining", 0),
                "quota_used_today": email_quota.get("used_today", 0),
                "status": "ready" if email_service.enabled else "disabled"
            },
            "push": {
                "fcm_enabled": push_config["enabled"],
                "android_supported": push_config["android_supported"],
                "ios_supported": push_config["ios_supported"],
                "production_ready": push_config["ready_for_production"],
                "status": "ready" if push_config["enabled"] else "disabled"
            },
            "in_app": {
                "enabled": True,
                "status": "ready"
            }
        },
        "user_channels": {
            "email": {
                "available": bool(current_user.email),
                "address": current_user.email
            },
            "push_android": {
                "available": len(user_android_tokens) > 0,
                "token_count": len(user_android_tokens),
                "tokens": [
                    {
                        "id": token.id,
                        "is_active": token.is_active,
                        "last_used": token.last_used_at.isoformat() if token.last_used_at else None,
                        "device_info": token.device_info
                    }
                    for token in user_android_tokens
                ]
            },
            "push_ios": {
                "available": len(user_ios_tokens) > 0,
                "token_count": len(user_ios_tokens),
                "coming_soon": True,
                "status": "iOS push notifications coming soon with Apple Developer account"
            },
            "in_app": {
                "available": True,
                "status": "always_available"
            }
        },
        "system_stats": {
            "total_device_tokens": device_stats.total_tokens,
            "android_devices": device_stats.android_tokens,
            "ios_devices": device_stats.ios_tokens,
            "email_service": routing_stats["email"],
            "push_service": routing_stats["push"]
        },
        "recommendations": await get_user_recommendations(current_user, user_android_tokens, user_ios_tokens)
    }

async def get_user_recommendations(user: User, android_tokens: List, ios_tokens: List) -> List[str]:
    """Get personalized recommendations for the user"""
    recommendations = []
    
    if not user.email:
        recommendations.append("📧 Add an email address to receive email notifications")
    
    if len(android_tokens) == 0 and len(ios_tokens) == 0:
        recommendations.append("📱 Enable push notifications in your device settings")
    
    if len(android_tokens) == 0:
        recommendations.append("🤖 Android users: Enable push notifications for instant alerts")
    
    if len(ios_tokens) == 0:
        recommendations.append("🍎 iOS users: Push notifications coming soon! Email notifications work great meanwhile")
    
    if user.email and len(android_tokens) > 0:
        recommendations.append("✅ You're all set! You'll receive notifications via email, push, and in-app")
    
    return recommendations

@router.get("/test-all-channels")
async def test_all_notification_channels(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis)
):
    """Test all available notification channels for the user"""
    
    results = {}
    
    # Test each notification type
    test_notifications = [
        {
            "type": NotificationType.BOOKING_SUCCESS,
            "title": "Test: Booking Confirmed",
            "body": "Testing booking success notifications",
            "priority": NotificationPriority.NORMAL
        },
        {
            "type": NotificationType.BOOKING_CANCELLED,
            "title": "Test: Booking Cancelled",
            "body": "Testing booking cancellation notifications",
            "priority": NotificationPriority.HIGH
        },
        {
            "type": NotificationType.PAYMENT_FAILED,
            "title": "Test: Payment Failed",
            "body": "Testing critical payment failure notifications",
            "priority": NotificationPriority.CRITICAL
        }
    ]
    
    routing_service = NotificationRoutingService(db, redis_client)
    
    for test_notif in test_notifications:
        try:
            result = await routing_service.create_and_route_notification(
                user_id=current_user.id,
                notification_type=test_notif["type"],
                title=test_notif["title"],
                body=test_notif["body"],
                data={"test": True, "timestamp": datetime.now(timezone.utc).isoformat()},
                language='en'
            )
            
            results[test_notif["type"].value] = {
                "status": "success",
                "channels_successful": result.channels_successful,
                "channels_failed": result.channels_failed,
                "total_delivered": result.total_delivered,
                "notification_id": result.notification_id
            }
            
        except Exception as e:
            results[test_notif["type"].value] = {
                "status": "failed",
                "error": str(e),
                "channels_successful": [],
                "channels_failed": ["all"],
                "total_delivered": 0
            }
    
    return {
        "user_id": current_user.id,
        "test_results": results,
        "summary": {
            "total_tests": len(test_notifications),
            "successful_tests": len([r for r in results.values() if r["status"] == "success"]),
            "failed_tests": len([r for r in results.values() if r["status"] == "failed"]),
            "total_notifications_delivered": sum(r.get("total_delivered", 0) for r in results.values())
        }
    }