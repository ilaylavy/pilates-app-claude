import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

from ..models.notification import Notification, NotificationPriority, NotificationType
from ..models.user import User, UserRole
from ..services.email_service import EmailService
from ..services.push_notification_service import PushNotificationService
from ..services.notification_service import NotificationService
from ..services.device_token_service import DeviceTokenService
from ..core.config import settings

logger = logging.getLogger("notification_routing")

@dataclass
class ChannelResult:
    """Result from a single notification channel"""
    channel: str
    status: str
    message_id: Optional[str] = None
    delivered_count: int = 0
    failed_count: int = 0
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

@dataclass
class RoutingResult:
    """Result from multi-channel notification routing"""
    notification_id: int
    user_id: int
    channels_attempted: List[str]
    channels_successful: List[str]
    channels_failed: List[str]
    total_delivered: int
    channel_results: List[ChannelResult]

class NotificationRoutingService:
    """Multi-channel notification routing service"""
    
    def __init__(self, db: AsyncSession, redis_client: Optional[redis.Redis] = None):
        self.db = db
        self.redis = redis_client
        self.email_service = EmailService(redis_client)
        self.push_service = PushNotificationService(db, redis_client)
        self.notification_service = NotificationService(db, redis_client)
        self.device_service = DeviceTokenService(db, redis_client)
        
        # Channel priority matrix based on notification priority
        self.channel_matrix = {
            NotificationPriority.CRITICAL: ["email", "push", "in_app"],
            NotificationPriority.HIGH: ["push", "in_app", "email"],
            NotificationPriority.NORMAL: ["in_app", "push"],
            NotificationPriority.LOW: ["in_app"]
        }
    
    async def route_notification(
        self,
        notification: Notification,
        user: User,
        language: str = 'en',
        force_channels: Optional[List[str]] = None
    ) -> RoutingResult:
        """Route notification through appropriate channels"""
        
        logger.info(f"Routing notification {notification.id} for user {user.id}")
        
        # Determine channels to use
        if force_channels:
            channels = force_channels
        else:
            channels = await self._get_channels_for_notification(notification, user)
        
        channel_results = []
        successful_channels = []
        failed_channels = []
        total_delivered = 0
        
        # Route through each channel
        for channel in channels:
            try:
                result = await self._send_via_channel(
                    channel, notification, user, language
                )
                
                channel_results.append(result)
                
                if result.status == "success" or result.delivered_count > 0:
                    successful_channels.append(channel)
                    total_delivered += result.delivered_count
                else:
                    failed_channels.append(channel)
                    
            except Exception as e:
                logger.error(f"Channel {channel} failed for notification {notification.id}: {str(e)}")
                failed_channels.append(channel)
                channel_results.append(ChannelResult(
                    channel=channel,
                    status="error",
                    error=str(e)
                ))
        
        # Log routing result
        logger.info(
            f"Notification {notification.id} routed: "
            f"attempted={len(channels)}, successful={len(successful_channels)}, "
            f"failed={len(failed_channels)}, delivered={total_delivered}"
        )
        
        return RoutingResult(
            notification_id=notification.id,
            user_id=user.id,
            channels_attempted=channels,
            channels_successful=successful_channels,
            channels_failed=failed_channels,
            total_delivered=total_delivered,
            channel_results=channel_results
        )
    
    async def route_bulk_notification(
        self,
        notification_type: NotificationType,
        title: str,
        body: str,
        user_ids: List[int],
        data: Optional[Dict[str, Any]] = None,
        priority: Optional[NotificationPriority] = None,
        sender_id: Optional[int] = None,
        language: str = 'en'
    ) -> List[RoutingResult]:
        """Create and route notification to multiple users"""
        
        logger.info(f"Bulk routing {notification_type} to {len(user_ids)} users")
        
        results = []
        
        # Create individual notifications for each user
        for user_id in user_ids:
            try:
                # Get user
                stmt = select(User).where(User.id == user_id, User.is_active == True)
                result = await self.db.execute(stmt)
                user = result.scalar_one_or_none()
                
                if not user:
                    logger.warning(f"User {user_id} not found or inactive, skipping")
                    continue
                
                # Create notification
                notification = await self.notification_service.create_notification(
                    user_id=user_id,
                    notification_type=notification_type,
                    title=title,
                    body=body,
                    data=data,
                    priority=priority,
                    sender_id=sender_id
                )
                
                # Route through channels
                routing_result = await self.route_notification(
                    notification, user, language
                )
                
                results.append(routing_result)
                
            except Exception as e:
                logger.error(f"Failed to route notification to user {user_id}: {str(e)}")
                # Add failed result
                results.append(RoutingResult(
                    notification_id=0,
                    user_id=user_id,
                    channels_attempted=[],
                    channels_successful=[],
                    channels_failed=["all"],
                    total_delivered=0,
                    channel_results=[ChannelResult(
                        channel="error",
                        status="failed",
                        error=str(e)
                    )]
                ))
        
        return results
    
    async def _get_channels_for_notification(
        self,
        notification: Notification,
        user: User
    ) -> List[str]:
        """Determine which channels to use for a notification"""
        
        # Get base channels from priority matrix
        base_channels = self.channel_matrix.get(
            notification.priority, ["in_app"]
        ).copy()
        
        # Filter channels based on availability
        available_channels = []
        
        for channel in base_channels:
            if await self._is_channel_available(channel, user):
                available_channels.append(channel)
        
        # Always include in_app as fallback
        if "in_app" not in available_channels:
            available_channels.append("in_app")
        
        return available_channels
    
    async def _is_channel_available(self, channel: str, user: User) -> bool:
        """Check if a channel is available for a user"""
        
        if channel == "email":
            return (
                bool(user.email) and 
                self.email_service.enabled and
                await self._user_allows_email(user)
            )
        
        elif channel == "push":
            android_tokens = await self.device_service.get_android_tokens(user.id)
            return (
                len(android_tokens) > 0 and
                self.push_service.is_enabled() and
                await self._user_allows_push(user)
            )
        
        elif channel == "in_app":
            return True  # Always available
        
        return False
    
    async def _user_allows_email(self, user: User) -> bool:
        """Check if user allows email notifications"""
        # TODO: Check user notification preferences
        # For now, assume all users allow email
        return True
    
    async def _user_allows_push(self, user: User) -> bool:
        """Check if user allows push notifications"""
        # TODO: Check user notification preferences  
        # For now, assume all users allow push
        return True
    
    async def _send_via_channel(
        self,
        channel: str,
        notification: Notification,
        user: User,
        language: str
    ) -> ChannelResult:
        """Send notification via specific channel"""
        
        if channel == "email":
            return await self._send_via_email(notification, user, language)
        
        elif channel == "push":
            return await self._send_via_push(notification, user, language)
        
        elif channel == "in_app":
            return await self._send_via_in_app(notification, user)
        
        else:
            return ChannelResult(
                channel=channel,
                status="unknown_channel",
                error=f"Unknown channel: {channel}"
            )
    
    async def _send_via_email(
        self,
        notification: Notification,
        user: User,
        language: str
    ) -> ChannelResult:
        """Send notification via email"""
        
        try:
            result = await self.email_service.send_notification_email(
                user=user,
                notification=notification,
                language=language
            )
            
            if result.status.value in ["sent", "queued"]:
                return ChannelResult(
                    channel="email",
                    status="success",
                    message_id=result.message_id,
                    delivered_count=1 if result.status.value == "sent" else 0,
                    details={
                        "email_status": result.status.value,
                        "queued_until": result.queued_until.isoformat() if result.queued_until else None
                    }
                )
            else:
                return ChannelResult(
                    channel="email",
                    status="failed",
                    error=result.error,
                    details={"email_status": result.status.value}
                )
                
        except Exception as e:
            return ChannelResult(
                channel="email",
                status="error",
                error=str(e)
            )
    
    async def _send_via_push(
        self,
        notification: Notification,
        user: User,
        language: str
    ) -> ChannelResult:
        """Send notification via push"""
        
        try:
            result = await self.push_service.send_notification_to_user(
                user=user,
                notification=notification,
                language=language
            )
            
            return ChannelResult(
                channel="push",
                status="success" if result.delivered_count > 0 else "failed",
                delivered_count=result.delivered_count,
                failed_count=result.failed_count,
                error=result.error,
                details=result.details
            )
            
        except Exception as e:
            return ChannelResult(
                channel="push",
                status="error",
                error=str(e)
            )
    
    async def _send_via_in_app(
        self,
        notification: Notification,
        user: User
    ) -> ChannelResult:
        """Send notification via in-app (already created)"""
        
        # In-app notification is already created by notification_service
        # Just return success
        return ChannelResult(
            channel="in_app",
            status="success",
            delivered_count=1,
            details={"notification_id": notification.id}
        )
    
    async def create_and_route_notification(
        self,
        user_id: int,
        notification_type: NotificationType,
        title: str,
        body: str,
        data: Optional[Dict[str, Any]] = None,
        priority: Optional[NotificationPriority] = None,
        sender_id: Optional[int] = None,
        language: str = 'en',
        force_channels: Optional[List[str]] = None
    ) -> RoutingResult:
        """Create notification and route through appropriate channels"""
        
        # Get user
        stmt = select(User).where(User.id == user_id, User.is_active == True)
        result = await self.db.execute(stmt)
        user = result.scalar_one_or_none()
        
        if not user:
            raise ValueError(f"User {user_id} not found or inactive")
        
        # Create notification
        notification = await self.notification_service.create_notification(
            user_id=user_id,
            notification_type=notification_type,
            title=title,
            body=body,
            data=data,
            priority=priority,
            sender_id=sender_id
        )
        
        # Route through channels
        return await self.route_notification(
            notification, user, language, force_channels
        )
    
    async def get_routing_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get routing statistics across all channels"""
        
        # Get email stats
        email_quota = await self.email_service.get_quota_status()
        
        # Get push stats
        push_stats = await self.push_service.get_delivery_stats(start_date, end_date)
        
        # Get device stats
        device_stats = await self.device_service.get_token_stats()
        
        return {
            "email": {
                "quota_remaining": email_quota.get("total_remaining", 0),
                "quota_used": email_quota.get("used_today", 0),
                "service_enabled": self.email_service.enabled
            },
            "push": {
                "total_sent": push_stats.get("total_sent", 0),
                "success_rate": push_stats.get("success_rate", 0),
                "service_enabled": self.push_service.is_enabled(),
                "android_devices": device_stats.android_tokens,
                "ios_devices": device_stats.ios_tokens
            },
            "in_app": {
                "always_available": True,
                "service_enabled": True
            },
            "period": {
                "start_date": start_date.isoformat() if start_date else None,
                "end_date": end_date.isoformat() if end_date else None
            }
        }