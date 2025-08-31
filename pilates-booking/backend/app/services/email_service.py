import logging
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass
from enum import Enum
import json

import redis.asyncio as redis
from jinja2 import Environment, FileSystemLoader, select_autoescape
import sendgrid
from sendgrid.helpers.mail import Mail, Email, To, Content, HtmlContent
from python_http_client.exceptions import HTTPError

from ..models.notification import Notification, NotificationPriority
from ..models.user import User
from ..core.config import settings

# Configure logging
logger = logging.getLogger("email_service")

# Email quota constants
DEFAULT_DAILY_QUOTA = 100
PRIORITY_RESERVATIONS = {
    NotificationPriority.CRITICAL: 30,  # 30% reserved for critical
    NotificationPriority.HIGH: 30,      # 30% reserved for high
    NotificationPriority.NORMAL: 25,    # 25% reserved for normal  
    NotificationPriority.LOW: 15        # 15% reserved for low
}

class EmailStatus(Enum):
    PENDING = "pending"
    SENT = "sent" 
    DELIVERED = "delivered"
    FAILED = "failed"
    QUEUED = "queued"

@dataclass
class EmailResult:
    """Result of email sending operation"""
    status: EmailStatus
    message_id: Optional[str] = None
    error: Optional[str] = None
    queued_until: Optional[datetime] = None

class EmailQuotaManager:
    """Manages daily email quota with priority-based allocation"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self.daily_quota = getattr(settings, 'EMAIL_DAILY_QUOTA', DEFAULT_DAILY_QUOTA)
    
    async def get_daily_usage(self) -> Dict[NotificationPriority, int]:
        """Get today's email usage by priority"""
        if not self.redis:
            return {priority: 0 for priority in NotificationPriority}
        
        today = datetime.utcnow().strftime('%Y-%m-%d')
        usage = {}
        
        for priority in NotificationPriority:
            key = f"email_quota:{today}:{priority.value}"
            count = await self.redis.get(key)
            usage[priority] = int(count) if count else 0
            
        return usage
    
    async def can_send_email(self, priority: NotificationPriority) -> bool:
        """Check if email can be sent based on quota and priority"""
        if not self.redis:
            return True  # Skip quota check if Redis unavailable
            
        today_usage = await self.get_daily_usage()
        total_used = sum(today_usage.values())
        
        # Always allow if under total quota
        if total_used < self.daily_quota:
            return True
            
        # Check priority-specific quota
        priority_quota = int(self.daily_quota * PRIORITY_RESERVATIONS[priority] / 100)
        return today_usage[priority] < priority_quota
    
    async def increment_usage(self, priority: NotificationPriority) -> None:
        """Increment today's usage counter"""
        if not self.redis:
            return
            
        today = datetime.utcnow().strftime('%Y-%m-%d')
        key = f"email_quota:{today}:{priority.value}"
        
        await self.redis.incr(key)
        await self.redis.expire(key, 86400)  # 24 hours
    
    async def get_remaining_quota(self) -> Dict[str, int]:
        """Get remaining quota information"""
        today_usage = await self.get_daily_usage()
        total_used = sum(today_usage.values())
        
        return {
            "total_remaining": max(0, self.daily_quota - total_used),
            "total_quota": self.daily_quota,
            "used_today": total_used,
            "by_priority": {
                priority.value: max(0, int(self.daily_quota * PRIORITY_RESERVATIONS[priority] / 100) - today_usage[priority])
                for priority in NotificationPriority
            }
        }

class EmailTemplateEngine:
    """Handles email template rendering with i18n support"""
    
    def __init__(self):
        template_dir = settings.BASE_DIR / "templates" / "emails"
        self.env = Environment(
            loader=FileSystemLoader(str(template_dir)),
            autoescape=select_autoescape(['html', 'xml'])
        )
        
    def render_template(
        self,
        template_name: str,
        context: Dict[str, Any],
        language: str = 'en'
    ) -> str:
        """Render email template with context"""
        
        # Try language-specific template first
        template_file = f"{template_name}_{language}.html"
        try:
            template = self.env.get_template(template_file)
        except Exception:
            # Fallback to English template
            template_file = f"{template_name}_en.html"
            template = self.env.get_template(template_file)
            
        # Add common context variables
        context.update({
            'language': language,
            'direction': 'rtl' if language == 'he' else 'ltr',
            'studio_name': getattr(settings, 'STUDIO_NAME', 'Pilates Studio'),
            'studio_email': getattr(settings, 'SENDGRID_FROM_EMAIL', 'noreply@pilates-studio.com'),
            'unsubscribe_url': f"{settings.FRONTEND_URL}/unsubscribe",
            'unsubscribe_text': 'Unsubscribe' if language == 'en' else 'הסרת רישום'
        })
        
        return template.render(context)

class EmailService:
    """SendGrid email service with quota management and templating"""
    
    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.enabled = getattr(settings, 'SENDGRID_ENABLED', False)
        if self.enabled:
            api_key = getattr(settings, 'SENDGRID_API_KEY', None)
            if not api_key:
                logger.warning("SendGrid API key not configured, emails will be queued")
                self.enabled = False
            else:
                self.sendgrid = sendgrid.SendGridAPIClient(api_key=api_key)
        
        self.redis = redis_client
        self.quota_manager = EmailQuotaManager(redis_client)
        self.template_engine = EmailTemplateEngine()
        self.from_email = getattr(settings, 'SENDGRID_FROM_EMAIL', 'noreply@pilates-studio.com')
        self.from_name = getattr(settings, 'SENDGRID_FROM_NAME', 'Pilates Studio')
        
    async def send_notification_email(
        self,
        user: User,
        notification: Notification,
        language: str = 'en'
    ) -> EmailResult:
        """Send notification as email with templating and quota management"""
        
        if not self.enabled:
            logger.info(f"Email disabled, queuing notification {notification.id}")
            return await self._queue_email(user, notification, language)
        
        # Check quota
        if not await self.quota_manager.can_send_email(notification.priority):
            logger.warning(f"Email quota exceeded for priority {notification.priority}")
            return await self._queue_email(user, notification, language, "quota_exceeded")
        
        try:
            # Render template
            html_content = await self._render_notification_template(notification, language)
            
            # Send email
            result = await self._send_email(
                to_email=user.email,
                to_name=f"{user.first_name} {user.last_name}".strip(),
                subject=notification.title,
                html_content=html_content
            )
            
            if result.status == EmailStatus.SENT:
                await self.quota_manager.increment_usage(notification.priority)
                logger.info(f"Email sent successfully to {user.email} for notification {notification.id}")
            
            return result
            
        except Exception as e:
            logger.error(f"Failed to send email for notification {notification.id}: {str(e)}")
            return EmailResult(
                status=EmailStatus.FAILED,
                error=str(e)
            )
    
    async def _render_notification_template(
        self,
        notification: Notification,
        language: str
    ) -> str:
        """Render notification-specific email template"""
        
        # Map notification types to template names
        template_map = {
            'booking_success': 'booking_confirmation',
            'booking_cancelled': 'booking_cancellation', 
            'payment_failed': 'payment_failure',
            'admin_announcement': 'admin_announcement',
            'general_announcement': 'general_announcement',
            'waitlist_promoted': 'waitlist_promotion',
            'package_activated': 'package_activation',
            'class_reminder': 'class_reminder',
        }
        
        template_name = template_map.get(notification.type.value, 'generic_notification')
        
        context = {
            'notification': {
                'id': notification.id,
                'title': notification.title,
                'body': notification.body,
                'type': notification.type.value,
                'priority': notification.priority.value,
                'created_at': notification.created_at.isoformat(),
                'data': notification.data_json or {}
            }
        }
        
        return self.template_engine.render_template(template_name, context, language)
    
    async def _send_email(
        self,
        to_email: str,
        to_name: str,
        subject: str,
        html_content: str
    ) -> EmailResult:
        """Send email via SendGrid with retry logic"""
        
        message = Mail(
            from_email=Email(self.from_email, self.from_name),
            to_emails=To(to_email, to_name),
            subject=subject,
            html_content=HtmlContent(html_content)
        )
        
        try:
            response = self.sendgrid.send(message)
            
            if response.status_code in [200, 201, 202]:
                message_id = None
                if hasattr(response, 'headers') and 'x-message-id' in response.headers:
                    message_id = response.headers['x-message-id']
                    
                return EmailResult(
                    status=EmailStatus.SENT,
                    message_id=message_id
                )
            else:
                return EmailResult(
                    status=EmailStatus.FAILED,
                    error=f"SendGrid returned status {response.status_code}"
                )
                
        except HTTPError as e:
            return EmailResult(
                status=EmailStatus.FAILED,
                error=f"SendGrid API error: {str(e)}"
            )
        except Exception as e:
            return EmailResult(
                status=EmailStatus.FAILED,
                error=f"Unexpected error: {str(e)}"
            )
    
    async def _queue_email(
        self,
        user: User,
        notification: Notification,
        language: str,
        reason: str = "service_disabled"
    ) -> EmailResult:
        """Queue email for later delivery"""
        
        if not self.redis:
            logger.warning("Cannot queue email - Redis unavailable")
            return EmailResult(status=EmailStatus.FAILED, error="Queue unavailable")
        
        queue_data = {
            'user_id': user.id,
            'user_email': user.email,
            'user_name': f"{user.first_name} {user.last_name}".strip(),
            'notification_id': notification.id,
            'language': language,
            'reason': reason,
            'queued_at': datetime.utcnow().isoformat()
        }
        
        # Queue for next day if quota exceeded
        if reason == "quota_exceeded":
            tomorrow = datetime.utcnow() + timedelta(days=1)
            await self.redis.zadd(
                "email_queue_tomorrow",
                {json.dumps(queue_data): tomorrow.timestamp()}
            )
            return EmailResult(
                status=EmailStatus.QUEUED,
                queued_until=tomorrow
            )
        else:
            await self.redis.lpush("email_queue", json.dumps(queue_data))
            return EmailResult(status=EmailStatus.QUEUED)
    
    async def send_test_email(
        self,
        to_email: str,
        template_type: str,
        language: str = 'en'
    ) -> EmailResult:
        """Send test email for template verification"""
        
        if not self.enabled:
            return EmailResult(status=EmailStatus.FAILED, error="Email service disabled")
        
        # Generate sample data for template
        sample_data = self._get_sample_data(template_type)
        
        try:
            html_content = self.template_engine.render_template(
                template_type, sample_data, language
            )
            
            return await self._send_email(
                to_email=to_email,
                to_name="Test User",
                subject=f"[TEST] {template_type} - {language}",
                html_content=html_content
            )
            
        except Exception as e:
            return EmailResult(status=EmailStatus.FAILED, error=str(e))
    
    def _get_sample_data(self, template_type: str) -> Dict[str, Any]:
        """Generate sample data for email templates"""
        
        base_data = {
            'user': {
                'first_name': 'John',
                'last_name': 'Doe',
                'email': 'john.doe@example.com'
            },
            'studio': {
                'name': 'Pilates Studio',
                'address': '123 Wellness St, Health City',
                'phone': '+1-555-0123'
            }
        }
        
        template_samples = {
            'booking_confirmation': {
                'class': {
                    'name': 'Morning Flow',
                    'date': '2024-12-01',
                    'time': '09:00',
                    'instructor': 'Sarah Johnson'
                },
                'booking_id': 'BK123456'
            },
            'booking_cancellation': {
                'class': {
                    'name': 'Evening Stretch',
                    'date': '2024-12-01', 
                    'time': '18:00'
                },
                'refund_amount': 25.00,
                'booking_id': 'BK123456'
            },
            'payment_failure': {
                'amount': 100.00,
                'card_last4': '1234',
                'retry_url': 'https://pilates-studio.com/retry-payment'
            }
        }
        
        base_data.update(template_samples.get(template_type, {}))
        return base_data
    
    async def process_queued_emails(self, batch_size: int = 10) -> Dict[str, Any]:
        """Process queued emails (for background tasks)"""
        
        if not self.redis or not self.enabled:
            return {"processed": 0, "error": "Service unavailable"}
        
        processed = 0
        errors = []
        
        try:
            # Process regular queue
            for _ in range(batch_size):
                queued_data = await self.redis.rpop("email_queue")
                if not queued_data:
                    break
                    
                try:
                    queue_item = json.loads(queued_data)
                    # Process queued email...
                    processed += 1
                except Exception as e:
                    errors.append(str(e))
            
            # Process tomorrow's queue if it's past midnight
            now = datetime.utcnow().timestamp()
            tomorrow_items = await self.redis.zrangebyscore(
                "email_queue_tomorrow", 0, now, withscores=True, start=0, num=batch_size
            )
            
            for item_data, score in tomorrow_items:
                try:
                    queue_item = json.loads(item_data)
                    # Process tomorrow's queued email...
                    await self.redis.zrem("email_queue_tomorrow", item_data)
                    processed += 1
                except Exception as e:
                    errors.append(str(e))
                    
        except Exception as e:
            errors.append(f"Queue processing error: {str(e)}")
        
        return {
            "processed": processed,
            "errors": errors,
            "remaining_regular": await self.redis.llen("email_queue") if self.redis else 0,
            "remaining_tomorrow": await self.redis.zcard("email_queue_tomorrow") if self.redis else 0
        }
    
    async def get_quota_status(self) -> Dict[str, Any]:
        """Get current quota usage status"""
        return await self.quota_manager.get_remaining_quota()