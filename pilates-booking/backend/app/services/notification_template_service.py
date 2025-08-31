import logging
from typing import Dict, List, Optional, Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..models.notification import NotificationTemplate, NotificationType
from ..services.notification_service import NotificationValidationError

logger = logging.getLogger("notification_templates")


class NotificationTemplateService:
    """Service for managing notification templates and rendering"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_template(self, notification_type: NotificationType) -> Optional[NotificationTemplate]:
        """Get template for specific notification type"""
        stmt = select(NotificationTemplate).where(NotificationTemplate.type == notification_type)
        result = await self.db.execute(stmt)
        return result.scalar_one_or_none()

    async def render_notification(
        self, 
        notification_type: NotificationType, 
        language: str = 'en',
        **variables
    ) -> Dict[str, str]:
        """Render notification template with variables"""
        
        template = await self.get_template(notification_type)
        if not template:
            raise NotificationValidationError(f"No template found for type: {notification_type}")

        try:
            title = template.render_title(language, **variables)
            body = template.render_body(language, **variables)
            
            return {
                "title": title,
                "body": body
            }
        except KeyError as e:
            raise NotificationValidationError(f"Missing template variable: {e}")
        except Exception as e:
            raise NotificationValidationError(f"Template rendering error: {e}")

    async def create_template(
        self,
        notification_type: NotificationType,
        title_en: str,
        title_he: str,
        body_en: str,
        body_he: str,
        variables: Optional[List[str]] = None
    ) -> NotificationTemplate:
        """Create new notification template"""
        
        try:
            template = NotificationTemplate(
                type=notification_type,
                title_en=title_en,
                title_he=title_he,
                body_en=body_en,
                body_he=body_he,
                variables=variables or []
            )
            
            self.db.add(template)
            await self.db.commit()
            await self.db.refresh(template)
            
            logger.info(f"Created template for type: {notification_type}")
            return template
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to create template: {str(e)}")
            raise

    async def update_template(
        self,
        notification_type: NotificationType,
        **updates
    ) -> Optional[NotificationTemplate]:
        """Update existing template"""
        
        template = await self.get_template(notification_type)
        if not template:
            return None

        try:
            for key, value in updates.items():
                if hasattr(template, key):
                    setattr(template, key, value)

            await self.db.commit()
            await self.db.refresh(template)
            
            logger.info(f"Updated template for type: {notification_type}")
            return template
            
        except Exception as e:
            await self.db.rollback()
            logger.error(f"Failed to update template: {str(e)}")
            raise

    async def list_templates(self) -> List[NotificationTemplate]:
        """Get all notification templates"""
        stmt = select(NotificationTemplate)
        result = await self.db.execute(stmt)
        return list(result.scalars().all())


# Default templates (your enhancement #6)
DEFAULT_TEMPLATES = [
    {
        "type": NotificationType.BOOKING_SUCCESS,
        "title_en": "Booking Confirmed",
        "title_he": "ההזמנה אושרה",
        "body_en": "Your booking for {class_name} on {date} at {time} is confirmed.",
        "body_he": "ההזמנה שלך ל-{class_name} בתאריך {date} בשעה {time} אושרה.",
        "variables": ["class_name", "date", "time"]
    },
    {
        "type": NotificationType.BOOKING_CANCELLED,
        "title_en": "Booking Cancelled",
        "title_he": "ההזמנה בוטלה",
        "body_en": "Your booking for {class_name} on {date} at {time} has been cancelled.",
        "body_he": "ההזמנה שלך ל-{class_name} בתאריך {date} בשעה {time} בוטלה.",
        "variables": ["class_name", "date", "time"]
    },
    {
        "type": NotificationType.PACKAGE_ACTIVATED,
        "title_en": "Package Activated",
        "title_he": "החבילה הופעלה",
        "body_en": "Your {package_name} package with {credits} credits is now active!",
        "body_he": "חבילת {package_name} שלך עם {credits} זיכויים פעילה כעת!",
        "variables": ["package_name", "credits"]
    },
    {
        "type": NotificationType.PAYMENT_PROCESSED,
        "title_en": "Payment Processed",
        "title_he": "התשלום עובד",
        "body_en": "Your payment of ₪{amount} for {package_name} has been processed successfully.",
        "body_he": "התשלום שלך של ₪{amount} עבור {package_name} עובד בהצלחה.",
        "variables": ["amount", "package_name"]
    },
    {
        "type": NotificationType.PAYMENT_FAILED,
        "title_en": "Payment Failed",
        "title_he": "התשלום נכשל",
        "body_en": "Your payment for {package_name} failed. Please update your payment method.",
        "body_he": "התשלום שלך עבור {package_name} נכשל. אנא עדכן את אמצעי התשלום שלך.",
        "variables": ["package_name"]
    },
    {
        "type": NotificationType.WAITLIST_PROMOTED,
        "title_en": "Spot Available!",
        "title_he": "יש מקום פנוי!",
        "body_en": "Great news! A spot opened up for {class_name} on {date} at {time}. Book now!",
        "body_he": "חדשות טובות! התפנה מקום ל-{class_name} בתאריך {date} בשעה {time}. הזמן עכשיו!",
        "variables": ["class_name", "date", "time"]
    },
    {
        "type": NotificationType.CLASS_REMINDER,
        "title_en": "Class Reminder",
        "title_he": "תזכורת לשיעור",
        "body_en": "Reminder: You have {class_name} starting in {hours} hours at {time}.",
        "body_he": "תזכורת: יש לך {class_name} שמתחיל בעוד {hours} שעות בשעה {time}.",
        "variables": ["class_name", "hours", "time"]
    },
    {
        "type": NotificationType.ADMIN_ANNOUNCEMENT,
        "title_en": "Announcement",
        "title_he": "הודעה",
        "body_en": "{message}",
        "body_he": "{message}",
        "variables": ["message"]
    },
    {
        "type": NotificationType.URGENT_ANNOUNCEMENT,
        "title_en": "Urgent Notice",
        "title_he": "הודעה דחופה",
        "body_en": "URGENT: {message}",
        "body_he": "דחוף: {message}",
        "variables": ["message"]
    },
    {
        "type": NotificationType.GENERAL_ANNOUNCEMENT,
        "title_en": "Update",
        "title_he": "עדכון",
        "body_en": "{message}",
        "body_he": "{message}",
        "variables": ["message"]
    },
    {
        "type": NotificationType.SYSTEM_MAINTENANCE,
        "title_en": "System Maintenance",
        "title_he": "תחזוקת מערכת",
        "body_en": "System maintenance is scheduled from {start_time} to {end_time}. Service may be temporarily unavailable.",
        "body_he": "תחזוקת מערכת מתוכננת מ-{start_time} עד {end_time}. השירות עשוי להיות לא זמין זמנית.",
        "variables": ["start_time", "end_time"]
    },
    {
        "type": NotificationType.ACCOUNT_VERIFIED,
        "title_en": "Account Verified",
        "title_he": "החשבון אומת",
        "body_en": "Welcome {first_name}! Your account has been verified. You can now book classes.",
        "body_he": "ברוך הבא {first_name}! החשבון שלך אומת. כעת תוכל להזמין שיעורים.",
        "variables": ["first_name"]
    }
]


async def seed_default_templates(db: AsyncSession) -> None:
    """Seed database with default notification templates"""
    
    logger.info("Seeding default notification templates")
    template_service = NotificationTemplateService(db)
    
    created_count = 0
    skipped_count = 0
    
    for template_data in DEFAULT_TEMPLATES:
        try:
            notification_type = template_data["type"]
            
            # Check if template already exists
            existing = await template_service.get_template(notification_type)
            if existing:
                logger.debug(f"Template for {notification_type} already exists, skipping")
                skipped_count += 1
                continue
            
            # Create new template
            await template_service.create_template(
                notification_type=notification_type,
                title_en=template_data["title_en"],
                title_he=template_data["title_he"],
                body_en=template_data["body_en"],
                body_he=template_data["body_he"],
                variables=template_data["variables"]
            )
            
            created_count += 1
            logger.info(f"Created template for {notification_type}")
            
        except Exception as e:
            logger.error(f"Failed to create template for {template_data['type']}: {str(e)}")
            continue
    
    logger.info(f"Template seeding completed: {created_count} created, {skipped_count} skipped")