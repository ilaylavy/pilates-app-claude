"""
Modern Firebase Cloud Messaging service using Firebase Admin SDK
Replaces the deprecated PyFCM approach with the modern v1 API
"""
import json
import logging
from datetime import datetime
from typing import List, Dict, Any, Optional
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis

# Firebase Admin SDK imports
try:
    import firebase_admin
    from firebase_admin import credentials, messaging
    FIREBASE_AVAILABLE = True
except ImportError:
    FIREBASE_AVAILABLE = False
    firebase_admin = None
    credentials = None
    messaging = None

from ..models.user import User
from ..models.notification import Notification
from ..models.device_token import DeviceToken, DevicePlatform
from ..core.config import settings

logger = logging.getLogger("push_notifications")

@dataclass
class PushDeliveryResult:
    """Result from push notification delivery"""
    delivered_count: int = 0
    failed_count: int = 0
    error: Optional[str] = None
    details: Optional[Dict[str, Any]] = None

class PushNotificationService:
    """Modern Firebase Cloud Messaging service using Admin SDK"""
    
    def __init__(self, db: AsyncSession, redis_client: Optional[redis.Redis] = None):
        self.db = db
        self.redis = redis_client
        self.firebase_app = None
        self.enabled = False
        
        if not FIREBASE_AVAILABLE:
            logger.warning("Firebase Admin SDK not available. Push notifications disabled.")
            return
        
        self._initialize_firebase()
    
    def _initialize_firebase(self):
        """Initialize Firebase Admin SDK"""
        try:
            # Check if Firebase is already initialized
            if firebase_admin._apps:
                self.firebase_app = firebase_admin.get_app()
                self.enabled = True
                logger.info("Firebase Admin SDK already initialized")
                return
            
            # Method 1: Use GOOGLE_APPLICATION_CREDENTIALS environment variable
            if settings.GOOGLE_APPLICATION_CREDENTIALS:
                try:
                    cred = credentials.ApplicationDefault()
                    self.firebase_app = firebase_admin.initialize_app(cred, {
                        'projectId': settings.FIREBASE_PROJECT_ID
                    })
                    self.enabled = True
                    logger.info("Firebase initialized with Application Default Credentials")
                    return
                except Exception as e:
                    logger.warning(f"Failed to initialize with ADC: {e}")
            
            # Method 2: Use service account key from environment
            if settings.FIREBASE_SERVICE_ACCOUNT_KEY:
                try:
                    # Try to parse as JSON string first
                    if settings.FIREBASE_SERVICE_ACCOUNT_KEY.startswith('{'):
                        service_account_info = json.loads(settings.FIREBASE_SERVICE_ACCOUNT_KEY)
                        cred = credentials.Certificate(service_account_info)
                    else:
                        # Treat as file path
                        cred = credentials.Certificate(settings.FIREBASE_SERVICE_ACCOUNT_KEY)
                    
                    self.firebase_app = firebase_admin.initialize_app(cred, {
                        'projectId': settings.FIREBASE_PROJECT_ID
                    })
                    self.enabled = True
                    logger.info("Firebase initialized with service account key")
                    return
                except Exception as e:
                    logger.warning(f"Failed to initialize with service account key: {e}")
            
            # Method 3: Try project ID only (for environments with default credentials)
            if settings.FIREBASE_PROJECT_ID:
                try:
                    self.firebase_app = firebase_admin.initialize_app(options={
                        'projectId': settings.FIREBASE_PROJECT_ID
                    })
                    self.enabled = True
                    logger.info("Firebase initialized with project ID only")
                    return
                except Exception as e:
                    logger.warning(f"Failed to initialize with project ID only: {e}")
            
            logger.error("Failed to initialize Firebase Admin SDK. All methods failed.")
            
        except Exception as e:
            logger.error(f"Firebase initialization error: {e}")
            self.enabled = False
    
    def is_enabled(self) -> bool:
        """Check if push notification service is enabled"""
        return self.enabled and self.firebase_app is not None
    
    def get_config_status(self) -> Dict[str, Any]:
        """Get configuration status for debugging"""
        return {
            "firebase_available": FIREBASE_AVAILABLE,
            "firebase_initialized": self.firebase_app is not None,
            "enabled": self.enabled,
            "project_id": settings.FIREBASE_PROJECT_ID,
            "has_service_account": bool(settings.FIREBASE_SERVICE_ACCOUNT_KEY),
            "has_adc": bool(settings.GOOGLE_APPLICATION_CREDENTIALS),
            "android_supported": True,
            "ios_supported": True,  # Now supported with Admin SDK
            "ready_for_production": self.enabled
        }
    
    async def send_notification_to_user(
        self,
        user: User,
        notification: Notification,
        language: str = 'en'
    ) -> PushDeliveryResult:
        """Send push notification to all user's devices"""
        
        if not self.is_enabled():
            return PushDeliveryResult(
                error="Push notification service not enabled"
            )
        
        try:
            # Get all active device tokens for user
            stmt = select(DeviceToken).where(
                DeviceToken.user_id == user.id,
                DeviceToken.is_active == True
            )
            result = await self.db.execute(stmt)
            device_tokens = result.scalars().all()
            
            if not device_tokens:
                return PushDeliveryResult(
                    error="No active device tokens found for user"
                )
            
            # Prepare FCM message
            fcm_message = self._create_fcm_message(notification, language)
            
            delivered_count = 0
            failed_count = 0
            failed_tokens = []
            
            # Send to each device token
            for device_token in device_tokens:
                try:
                    # Handle test tokens in development
                    if device_token.token.startswith('ExponentPushToken[test-'):
                        logger.info(f"Simulating successful push to test token: {device_token.id}")
                        device_token.last_used_at = datetime.utcnow()
                        delivered_count += 1
                        continue
                    
                    # Create message for specific token
                    notification_obj = messaging.Notification(
                        title=fcm_message['notification']['title'],
                        body=fcm_message['notification']['body']
                    )
                    
                    # Create Android config
                    android_config = messaging.AndroidConfig(
                        notification=messaging.AndroidNotification(
                            channel_id=fcm_message['android']['notification']['channel_id'],
                            priority=fcm_message['android']['notification']['priority'],
                            sound=fcm_message['android']['notification']['sound'],
                            color=fcm_message['android']['notification']['color']
                        ),
                        priority=fcm_message['android']['priority']
                    )
                    
                    # Create APNS config for iOS
                    apns_config = messaging.APNSConfig(
                        payload=messaging.APNSPayload(
                            aps=messaging.Aps(
                                alert=messaging.ApsAlert(
                                    title=fcm_message['apns']['payload']['aps']['alert']['title'],
                                    body=fcm_message['apns']['payload']['aps']['alert']['body']
                                ),
                                sound=fcm_message['apns']['payload']['aps']['sound'],
                                badge=fcm_message['apns']['payload']['aps']['badge']
                            )
                        )
                    )
                    
                    message = messaging.Message(
                        token=device_token.token,
                        notification=notification_obj,
                        data=fcm_message.get('data', {}),
                        android=android_config,
                        apns=apns_config
                    )
                    
                    # Send message
                    response = messaging.send(message)
                    
                    # Update last used timestamp
                    device_token.last_used_at = datetime.utcnow()
                    delivered_count += 1
                    
                    logger.info(f"Push notification sent successfully to {device_token.platform.value} device: {response}")
                    
                except messaging.UnregisteredError:
                    # Token is no longer valid, deactivate it
                    device_token.is_active = False
                    failed_tokens.append(device_token.token)
                    failed_count += 1
                    logger.warning(f"Device token {device_token.id} is unregistered, deactivating")
                    
                except Exception as e:
                    failed_count += 1
                    failed_tokens.append(device_token.token)
                    logger.error(f"Failed to send push to token {device_token.id}: {e}")
            
            # Commit database changes
            await self.db.commit()
            
            return PushDeliveryResult(
                delivered_count=delivered_count,
                failed_count=failed_count,
                details={
                    "total_tokens": len(device_tokens),
                    "failed_tokens": len(failed_tokens),
                    "notification_id": notification.id
                }
            )
            
        except Exception as e:
            logger.error(f"Error sending push notifications: {e}")
            return PushDeliveryResult(
                failed_count=1,
                error=str(e)
            )
    
    def _create_fcm_message(
        self,
        notification: Notification,
        language: str = 'en'
    ) -> Dict[str, Any]:
        """Create FCM message payload"""
        
        # Basic notification payload
        fcm_data = {
            'notification': {
                'title': notification.title,
                'body': notification.body
            },
            'data': {
                'notification_id': str(notification.id),
                'type': notification.type.value,
                'priority': notification.priority.value,
                'language': language
            }
        }
        
        # Add custom data if available
        if notification.data_json:
            # Convert all data values to strings (FCM requirement)
            for key, value in notification.data_json.items():
                fcm_data['data'][f'custom_{key}'] = str(value)
        
        # Android-specific configuration
        fcm_data['android'] = {
            'notification': {
                'channel_id': 'default',
                'priority': 'high' if notification.priority.value in ['HIGH', 'CRITICAL'] else 'default',
                'sound': 'default',
                'color': '#FF6B35'  # Pilates brand color
            },
            'priority': 'high' if notification.priority.value in ['HIGH', 'CRITICAL'] else 'normal'
        }
        
        # iOS-specific configuration
        fcm_data['apns'] = {
            'payload': {
                'aps': {
                    'alert': {
                        'title': notification.title,
                        'body': notification.body
                    },
                    'sound': 'default',
                    'badge': 1,
                    'priority': 10 if notification.priority.value in ['HIGH', 'CRITICAL'] else 5
                }
            }
        }
        
        return fcm_data
    
    async def send_bulk_notification(
        self,
        user_tokens: List[tuple],  # List of (user, tokens) tuples
        notification: Notification,
        language: str = 'en'
    ) -> PushDeliveryResult:
        """Send push notification to multiple users efficiently"""
        
        if not self.is_enabled():
            return PushDeliveryResult(
                error="Push notification service not enabled"
            )
        
        try:
            # Prepare all tokens
            all_tokens = []
            for user, tokens in user_tokens:
                all_tokens.extend([token.token for token in tokens])
            
            if not all_tokens:
                return PushDeliveryResult(
                    error="No device tokens provided"
                )
            
            # Create multicast message
            fcm_message = self._create_fcm_message(notification, language)
            
            # Create notification object
            notification_obj = messaging.Notification(
                title=fcm_message['notification']['title'],
                body=fcm_message['notification']['body']
            )
            
            # Create Android config
            android_config = messaging.AndroidConfig(
                notification=messaging.AndroidNotification(
                    channel_id=fcm_message['android']['notification']['channel_id'],
                    priority=fcm_message['android']['notification']['priority'],
                    sound=fcm_message['android']['notification']['sound'],
                    color=fcm_message['android']['notification']['color']
                ),
                priority=fcm_message['android']['priority']
            )
            
            # Create APNS config
            apns_config = messaging.APNSConfig(
                payload=messaging.APNSPayload(
                    aps=messaging.Aps(
                        alert=messaging.ApsAlert(
                            title=fcm_message['apns']['payload']['aps']['alert']['title'],
                            body=fcm_message['apns']['payload']['aps']['alert']['body']
                        ),
                        sound=fcm_message['apns']['payload']['aps']['sound'],
                        badge=fcm_message['apns']['payload']['aps']['badge']
                    )
                )
            )
            
            multicast_message = messaging.MulticastMessage(
                tokens=all_tokens,
                notification=notification_obj,
                data=fcm_message.get('data', {}),
                android=android_config,
                apns=apns_config
            )
            
            # Send multicast message
            response = messaging.send_multicast(multicast_message)
            
            # Process results
            delivered_count = response.success_count
            failed_count = response.failure_count
            
            # Handle failed tokens
            if response.failure_count > 0:
                for idx, result in enumerate(response.responses):
                    if not result.success:
                        token = all_tokens[idx]
                        if isinstance(result.exception, messaging.UnregisteredError):
                            # Deactivate unregistered tokens
                            await self._deactivate_token_by_value(token)
                        logger.warning(f"Failed to send to token {idx}: {result.exception}")
            
            await self.db.commit()
            
            return PushDeliveryResult(
                delivered_count=delivered_count,
                failed_count=failed_count,
                details={
                    "total_tokens": len(all_tokens),
                    "multicast_id": response.responses[0].message_id if response.responses else None
                }
            )
            
        except Exception as e:
            logger.error(f"Error sending bulk push notifications: {e}")
            return PushDeliveryResult(
                failed_count=len(all_tokens) if 'all_tokens' in locals() else 0,
                error=str(e)
            )
    
    async def _deactivate_token_by_value(self, token_value: str):
        """Deactivate device token by token value"""
        try:
            stmt = select(DeviceToken).where(DeviceToken.token == token_value)
            result = await self.db.execute(stmt)
            device_token = result.scalar_one_or_none()
            
            if device_token:
                device_token.is_active = False
                logger.info(f"Deactivated invalid token {device_token.id}")
        except Exception as e:
            logger.error(f"Error deactivating token: {e}")
    

    async def get_delivery_stats(
        self,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict[str, Any]:
        """Get push notification delivery statistics"""
        
        # For now, return basic stats
        # In production, you might want to store delivery results in database
        
        return {
            "service_enabled": self.enabled,
            "total_sent": 0,  # Would track this in production
            "success_rate": 100.0,  # Would calculate from actual data
            "platform_stats": {
                "android": {"sent": 0, "delivered": 0},
                "ios": {"sent": 0, "delivered": 0}
            }
        }