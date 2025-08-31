import logging
import asyncio
from datetime import datetime
from typing import List, Optional, Dict, Any
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
from pyfcm import FCMNotification
from pyfcm.errors import FCMError, AuthenticationError, FCMNotRegisteredError

from ..models.notification import Notification, NotificationPriority
from ..models.user import User
from ..models.device_token import DeviceToken, PushDelivery, DevicePlatform, PushDeliveryStatus
from ..services.device_token_service import DeviceTokenService
from ..core.config import settings

logger = logging.getLogger("push_notifications")

@dataclass
class PushResult:
    """Result of push notification delivery"""
    status: str
    message_id: Optional[str] = None
    error: Optional[str] = None
    delivered_count: int = 0
    failed_count: int = 0
    details: List[Dict[str, Any]] = None

class PushNotificationService:
    """Firebase Cloud Messaging push notification service"""
    
    def __init__(self, db: AsyncSession, redis_client: Optional[redis.Redis] = None):
        self.db = db
        self.redis = redis_client
        self.device_service = DeviceTokenService(db, redis_client)
        
        # Initialize FCM
        self.fcm_enabled = bool(getattr(settings, 'FCM_SERVER_KEY', None))
        if self.fcm_enabled:
            try:
                self.fcm = FCMNotification(api_key=settings.FCM_SERVER_KEY)
                logger.info("FCM service initialized successfully")
            except Exception as e:
                logger.error(f"Failed to initialize FCM: {str(e)}")
                self.fcm_enabled = False
                self.fcm = None
        else:
            logger.warning("FCM not configured - push notifications disabled")
            self.fcm = None
    
    async def send_notification_to_user(
        self,
        user: User,
        notification: Notification,
        language: str = 'en'
    ) -> PushResult:
        """Send push notification to a specific user's Android devices"""
        
        if not self.fcm_enabled:
            return PushResult(
                status="disabled",
                error="FCM service not configured"
            )
        
        # Get user's active Android tokens
        android_tokens = await self.device_service.get_android_tokens(user.id)
        
        if not android_tokens:
            return PushResult(
                status="no_tokens",
                error="No active Android tokens found for user"
            )
        
        # Prepare push payload
        push_data = await self._prepare_push_payload(notification, language)
        
        # Send to all Android devices
        results = []
        delivered_count = 0
        failed_count = 0
        
        for device_token in android_tokens:
            try:
                result = await self._send_to_device(
                    device_token, notification, push_data
                )
                results.append(result)
                
                if result["status"] == "sent":
                    delivered_count += 1
                else:
                    failed_count += 1
                    
            except Exception as e:
                logger.error(f"Failed to send to device {device_token.id}: {str(e)}")
                failed_count += 1
                results.append({
                    "device_token_id": device_token.id,
                    "status": "failed",
                    "error": str(e)
                })
        
        return PushResult(
            status="completed",
            delivered_count=delivered_count,
            failed_count=failed_count,
            details=results
        )
    
    async def send_to_multiple_users(
        self,
        user_ids: List[int],
        notification: Notification,
        language: str = 'en'
    ) -> PushResult:
        """Send push notification to multiple users"""
        
        if not self.fcm_enabled:
            return PushResult(
                status="disabled",
                error="FCM service not configured"
            )
        
        # Get Android tokens for all users
        user_tokens = await self.device_service.get_tokens_for_users(
            user_ids, DevicePlatform.ANDROID
        )
        
        if not user_tokens:
            return PushResult(
                status="no_tokens",
                error="No active Android tokens found for any user"
            )
        
        # Prepare push payload once
        push_data = await self._prepare_push_payload(notification, language)
        
        # Send to all devices
        total_delivered = 0
        total_failed = 0
        all_results = []
        
        for user_id, tokens in user_tokens.items():
            for device_token in tokens:
                try:
                    result = await self._send_to_device(
                        device_token, notification, push_data
                    )
                    all_results.append({
                        **result,
                        "user_id": user_id
                    })
                    
                    if result["status"] == "sent":
                        total_delivered += 1
                    else:
                        total_failed += 1
                        
                except Exception as e:
                    logger.error(f"Failed to send to device {device_token.id}: {str(e)}")
                    total_failed += 1
                    all_results.append({
                        "device_token_id": device_token.id,
                        "user_id": user_id,
                        "status": "failed",
                        "error": str(e)
                    })
        
        return PushResult(
            status="completed",
            delivered_count=total_delivered,
            failed_count=total_failed,
            details=all_results
        )
    
    async def _send_to_device(
        self,
        device_token: DeviceToken,
        notification: Notification,
        push_data: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Send push notification to a single device"""
        
        # Create delivery record
        push_delivery = PushDelivery(
            notification_id=notification.id,
            device_token_id=device_token.id,
            status=PushDeliveryStatus.PENDING
        )
        self.db.add(push_delivery)
        await self.db.flush()  # Get ID without committing
        
        try:
            # Send via FCM
            result = self.fcm.notify_single_device(
                registration_id=device_token.token,
                message_title=push_data["title"],
                message_body=push_data["body"],
                data_message=push_data["data"],
                # Additional FCM options
                sound="default",
                badge=1,
                click_action="FLUTTER_NOTIFICATION_CLICK",
                content_available=True
            )
            
            # Process FCM response
            if result.get('success', 0) > 0:
                # Success
                push_delivery.mark_sent(result.get('multicast_id'))
                device_token.update_last_used()
                
                await self.db.commit()
                
                return {
                    "device_token_id": device_token.id,
                    "status": "sent",
                    "fcm_result": result,
                    "delivery_id": push_delivery.id
                }
            else:
                # Failed
                error_msg = str(result.get('results', [{}])[0].get('error', 'Unknown error'))
                push_delivery.mark_failed(error_msg)
                
                # Handle specific FCM errors
                if 'NotRegistered' in error_msg or 'InvalidRegistration' in error_msg:
                    device_token.deactivate()
                    logger.info(f"Deactivated invalid device token {device_token.id}")
                
                await self.db.commit()
                
                return {
                    "device_token_id": device_token.id,
                    "status": "failed",
                    "error": error_msg,
                    "delivery_id": push_delivery.id
                }
                
        except FCMNotRegisteredError:
            # Token is no longer valid
            push_delivery.mark_failed("Device token not registered")
            device_token.deactivate()
            await self.db.commit()
            
            logger.info(f"Deactivated unregistered device token {device_token.id}")
            
            return {
                "device_token_id": device_token.id,
                "status": "failed",
                "error": "Device token not registered",
                "delivery_id": push_delivery.id
            }
            
        except AuthenticationError as e:
            # FCM authentication error
            push_delivery.mark_failed(f"FCM authentication error: {str(e)}")
            await self.db.commit()
            
            logger.error(f"FCM authentication error: {str(e)}")
            
            return {
                "device_token_id": device_token.id,
                "status": "failed",
                "error": f"FCM authentication error: {str(e)}",
                "delivery_id": push_delivery.id
            }
            
        except FCMError as e:
            # Other FCM errors
            push_delivery.mark_failed(f"FCM error: {str(e)}")
            await self.db.commit()
            
            logger.error(f"FCM error for device {device_token.id}: {str(e)}")
            
            return {
                "device_token_id": device_token.id,
                "status": "failed",
                "error": f"FCM error: {str(e)}",
                "delivery_id": push_delivery.id
            }
            
        except Exception as e:
            # Unexpected errors
            push_delivery.mark_failed(f"Unexpected error: {str(e)}")
            await self.db.rollback()
            
            logger.error(f"Unexpected error sending push to device {device_token.id}: {str(e)}")
            
            return {
                "device_token_id": device_token.id,
                "status": "failed",
                "error": f"Unexpected error: {str(e)}",
                "delivery_id": push_delivery.id
            }
    
    async def _prepare_push_payload(
        self,
        notification: Notification,
        language: str = 'en'
    ) -> Dict[str, Any]:
        """Prepare push notification payload"""
        
        # Prepare data payload
        data_payload = {
            "notification_id": str(notification.id),
            "type": notification.type.value,
            "priority": notification.priority.value,
            "created_at": notification.created_at.isoformat(),
            **((notification.data_json or {}))
        }
        
        # Prepare notification payload
        return {
            "title": notification.title,
            "body": notification.body,
            "data": data_payload
        }
    
    async def send_test_push(
        self,
        device_token: DeviceToken,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Send test push notification"""
        
        if not self.fcm_enabled:
            return {
                "status": "disabled",
                "error": "FCM service not configured"
            }
        
        try:
            test_data = {
                "test": "true",
                "sent_at": datetime.utcnow().isoformat(),
                **(data or {})
            }
            
            result = self.fcm.notify_single_device(
                registration_id=device_token.token,
                message_title=title,
                message_body=body,
                data_message=test_data,
                sound="default"
            )
            
            if result.get('success', 0) > 0:
                device_token.update_last_used()
                await self.db.commit()
                
                return {
                    "status": "sent",
                    "fcm_result": result,
                    "message": "Test push sent successfully"
                }
            else:
                error_msg = str(result.get('results', [{}])[0].get('error', 'Unknown error'))
                return {
                    "status": "failed",
                    "error": error_msg,
                    "fcm_result": result
                }
                
        except Exception as e:
            logger.error(f"Failed to send test push: {str(e)}")
            return {
                "status": "failed",
                "error": str(e)
            }
    
    async def get_delivery_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get push delivery statistics"""
        
        try:
            from sqlalchemy import func, and_
            
            # Base query
            stmt = select(func.count(PushDelivery.id), PushDelivery.status).group_by(PushDelivery.status)
            
            # Add date filters if provided
            if start_date:
                stmt = stmt.where(PushDelivery.created_at >= start_date)
            if end_date:
                stmt = stmt.where(PushDelivery.created_at <= end_date)
            
            result = await self.db.execute(stmt)
            status_counts = dict(result.fetchall())
            
            # Calculate totals
            total_sent = sum(status_counts.values())
            success_rate = 0
            if total_sent > 0:
                delivered = status_counts.get(PushDeliveryStatus.DELIVERED, 0)
                sent = status_counts.get(PushDeliveryStatus.SENT, 0)
                success_rate = ((delivered + sent) / total_sent) * 100
            
            return {
                "total_sent": total_sent,
                "success_rate": round(success_rate, 2),
                "status_breakdown": status_counts,
                "period": {
                    "start_date": start_date.isoformat() if start_date else None,
                    "end_date": end_date.isoformat() if end_date else None
                }
            }
            
        except Exception as e:
            logger.error(f"Failed to get delivery stats: {str(e)}")
            return {
                "total_sent": 0,
                "success_rate": 0,
                "status_breakdown": {},
                "error": str(e)
            }
    
    def is_enabled(self) -> bool:
        """Check if FCM service is enabled"""
        return self.fcm_enabled
    
    def get_config_status(self) -> Dict[str, Any]:
        """Get FCM configuration status"""
        return {
            "fcm_enabled": self.fcm_enabled,
            "has_server_key": bool(getattr(settings, 'FCM_SERVER_KEY', None)),
            "project_id": getattr(settings, 'FIREBASE_PROJECT_ID', None),
            "android_supported": True,
            "ios_supported": False,  # Will be True once we have APNs setup
            "ready_for_production": self.fcm_enabled
        }