"""
Business Event Logging Service

This service provides centralized business event logging for all critical operations
in the pilates booking system. It ensures consistent event tracking across the application.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, Optional

from ..core.logging_config import get_logger


class EventType(Enum):
    """Standardized business event types."""

    # User events
    USER_REGISTERED = "user.registered"
    USER_PROFILE_UPDATED = "user.profile_updated"
    USER_DELETED = "user.deleted"

    # Authentication events
    AUTH_LOGIN_SUCCESS = "auth.login_success"
    AUTH_LOGIN_FAILED = "auth.login_failed"
    AUTH_LOGOUT = "auth.logout"
    AUTH_TOKEN_REFRESHED = "auth.token_refreshed"
    AUTH_PASSWORD_RESET_REQUESTED = "auth.password_reset_requested"
    AUTH_PASSWORD_RESET_COMPLETED = "auth.password_reset_completed"

    # Booking events
    BOOKING_CREATED = "booking.created"
    BOOKING_CANCELLED = "booking.cancelled"
    BOOKING_MODIFIED = "booking.modified"
    BOOKING_NO_SHOW = "booking.no_show"
    BOOKING_CHECKED_IN = "booking.checked_in"

    # Waitlist events
    WAITLIST_JOINED = "waitlist.joined"
    WAITLIST_LEFT = "waitlist.left"
    WAITLIST_PROMOTED = "waitlist.promoted"

    # Package events
    PACKAGE_PURCHASED = "package.purchased"
    PACKAGE_USED = "package.credit_used"
    PACKAGE_EXPIRED = "package.expired"
    PACKAGE_REFUNDED = "package.refunded"

    # Payment events
    PAYMENT_INITIATED = "payment.initiated"
    PAYMENT_SUCCESS = "payment.success"
    PAYMENT_FAILED = "payment.failed"
    PAYMENT_REFUNDED = "payment.refunded"
    PAYMENT_DISPUTED = "payment.disputed"

    # Class events
    CLASS_CREATED = "class.created"
    CLASS_UPDATED = "class.updated"
    CLASS_CANCELLED = "class.cancelled"
    CLASS_CAPACITY_CHANGED = "class.capacity_changed"

    # Admin events
    ADMIN_USER_CREATED = "admin.user_created"
    ADMIN_USER_DELETED = "admin.user_deleted"
    ADMIN_CLASS_CREATED = "admin.class_created"
    ADMIN_CLASS_DELETED = "admin.class_deleted"
    ADMIN_PACKAGE_CREATED = "admin.package_created"
    ADMIN_PACKAGE_DELETED = "admin.package_deleted"
    ADMIN_SETTINGS_CHANGED = "admin.settings_changed"
    ADMIN_BULK_ACTION = "admin.bulk_action"

    # System events
    SYSTEM_STARTUP = "system.startup"
    SYSTEM_SHUTDOWN = "system.shutdown"
    SYSTEM_ERROR = "system.error"
    SYSTEM_BACKUP_CREATED = "system.backup_created"
    SYSTEM_MIGRATION_COMPLETED = "system.migration_completed"


class BusinessEventLogger:
    """Central business event logger for the pilates booking system."""

    def __init__(self):
        self.logger = get_logger("app.events")
        self.security_logger = get_logger("app.security")

    def log_event(self, event_type, **kwargs):
        """Log a business event with standardized format."""
        event_data = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            **kwargs,
        }

        # Handle both EventType enums and string values
        if isinstance(event_type, EventType):
            event_type_str = event_type.value
        else:
            event_type_str = str(event_type)
            
        self.logger.log_event(event_type_str, **event_data)

    # User Events
    def log_user_registered(
        self, user_id: str, email: str, registration_method: str = "web"
    ):
        """Log user registration event."""
        self.log_event(
            EventType.USER_REGISTERED,
            user_id=user_id,
            email=email,
            registration_method=registration_method,
        )

    def log_user_profile_updated(self, user_id: str, updated_fields: list):
        """Log user profile update event."""
        self.log_event(
            EventType.USER_PROFILE_UPDATED,
            user_id=user_id,
            updated_fields=updated_fields,
        )

    # Authentication Events
    def log_login_success(self, user_id: str, client_ip: str, user_agent: str):
        """Log successful login."""
        self.log_event(
            EventType.AUTH_LOGIN_SUCCESS,
            user_id=user_id,
            client_ip=client_ip,
            user_agent=user_agent,
        )

    def log_login_failed(
        self, email: str, reason: str, client_ip: str, user_agent: str
    ):
        """Log failed login attempt."""
        self.log_event(
            EventType.AUTH_LOGIN_FAILED,
            email=email,
            reason=reason,
            client_ip=client_ip,
            user_agent=user_agent,
        )

    def log_password_reset_requested(self, email: str, client_ip: str):
        """Log password reset request."""
        self.log_event(
            EventType.AUTH_PASSWORD_RESET_REQUESTED, email=email, client_ip=client_ip
        )

    # Booking Events
    def log_booking_created(
        self,
        user_id: str,
        class_id: str,
        booking_id: str,
        credits_used: int,
        booking_method: str = "web",
    ):
        """Log booking creation."""
        self.log_event(
            EventType.BOOKING_CREATED,
            user_id=user_id,
            class_id=class_id,
            booking_id=booking_id,
            credits_used=credits_used,
            booking_method=booking_method,
        )

    def log_booking_cancelled(
        self,
        user_id: str,
        class_id: str,
        booking_id: str,
        reason: str,
        credits_refunded: int,
    ):
        """Log booking cancellation."""
        self.log_event(
            EventType.BOOKING_CANCELLED,
            user_id=user_id,
            class_id=class_id,
            booking_id=booking_id,
            reason=reason,
            credits_refunded=credits_refunded,
        )

    def log_booking_checked_in(
        self, user_id: str, class_id: str, booking_id: str, check_in_time: datetime
    ):
        """Log booking check-in."""
        self.log_event(
            EventType.BOOKING_CHECKED_IN,
            user_id=user_id,
            class_id=class_id,
            booking_id=booking_id,
            check_in_time=check_in_time.isoformat(),
        )

    # Waitlist Events
    def log_waitlist_joined(self, user_id: str, class_id: str, position: int):
        """Log joining waitlist."""
        self.log_event(
            EventType.WAITLIST_JOINED,
            user_id=user_id,
            class_id=class_id,
            waitlist_position=position,
        )

    def log_waitlist_promoted(self, user_id: str, class_id: str, from_position: int):
        """Log waitlist promotion to booking."""
        self.log_event(
            EventType.WAITLIST_PROMOTED,
            user_id=user_id,
            class_id=class_id,
            from_position=from_position,
        )

    # Package Events
    def log_package_purchased(
        self,
        user_id: str,
        package_id: str,
        credits: int,
        amount_paid: float,
        payment_method: str,
    ):
        """Log package purchase."""
        self.log_event(
            EventType.PACKAGE_PURCHASED,
            user_id=user_id,
            package_id=package_id,
            credits=credits,
            amount_paid=amount_paid,
            payment_method=payment_method,
        )

    def log_package_credit_used(
        self,
        user_id: str,
        package_id: str,
        credits_used: int,
        remaining_credits: int,
        used_for: str,
    ):
        """Log package credit usage."""
        self.log_event(
            EventType.PACKAGE_USED,
            user_id=user_id,
            package_id=package_id,
            credits_used=credits_used,
            remaining_credits=remaining_credits,
            used_for=used_for,
        )

    def log_package_expired(self, user_id: str, package_id: str, unused_credits: int):
        """Log package expiration."""
        self.log_event(
            EventType.PACKAGE_EXPIRED,
            user_id=user_id,
            package_id=package_id,
            unused_credits=unused_credits,
        )

    # Payment Events
    def log_payment_success(
        self,
        user_id: str,
        payment_id: str,
        amount: float,
        currency: str,
        payment_method: str,
        stripe_payment_id: str = None,
    ):
        """Log successful payment."""
        self.log_event(
            EventType.PAYMENT_SUCCESS,
            user_id=user_id,
            payment_id=payment_id,
            amount=amount,
            currency=currency,
            payment_method=payment_method,
            stripe_payment_id=stripe_payment_id,
        )

    def log_payment_failed(
        self,
        user_id: str,
        amount: float,
        currency: str,
        reason: str,
        error_code: str = None,
    ):
        """Log failed payment."""
        self.log_event(
            EventType.PAYMENT_FAILED,
            user_id=user_id,
            amount=amount,
            currency=currency,
            reason=reason,
            error_code=error_code,
        )

    def log_payment_refunded(
        self,
        user_id: str,
        payment_id: str,
        refund_amount: float,
        reason: str,
        admin_id: str = None,
    ):
        """Log payment refund."""
        self.log_event(
            EventType.PAYMENT_REFUNDED,
            user_id=user_id,
            payment_id=payment_id,
            refund_amount=refund_amount,
            reason=reason,
            admin_id=admin_id,
        )

    # Class Events
    def log_class_created(
        self,
        class_id: str,
        instructor_id: str,
        capacity: int,
        start_time: datetime,
        admin_id: str = None,
    ):
        """Log class creation."""
        self.log_event(
            EventType.CLASS_CREATED,
            class_id=class_id,
            instructor_id=instructor_id,
            capacity=capacity,
            start_time=start_time.isoformat(),
            admin_id=admin_id,
        )

    def log_class_cancelled(
        self, class_id: str, reason: str, admin_id: str, affected_bookings: int
    ):
        """Log class cancellation."""
        self.log_event(
            EventType.CLASS_CANCELLED,
            class_id=class_id,
            reason=reason,
            admin_id=admin_id,
            affected_bookings=affected_bookings,
        )

    # Admin Events
    def log_admin_action(
        self,
        admin_id: str,
        action: str,
        target_type: str,
        target_id: str,
        details: Dict[str, Any] = None,
    ):
        """Log admin action."""
        self.log_event(
            EventType.ADMIN_BULK_ACTION,
            admin_id=admin_id,
            action=action,
            target_type=target_type,
            target_id=target_id,
            details=details or {},
        )

        # Also log to security logger for admin actions
        self.security_logger.log_security_event(
            f"admin.{action}",
            severity="info",
            admin_id=admin_id,
            target_type=target_type,
            target_id=target_id,
            details=details,
        )

    def log_settings_changed(
        self, admin_id: str, setting_name: str, old_value: Any, new_value: Any
    ):
        """Log system settings changes."""
        self.log_event(
            EventType.ADMIN_SETTINGS_CHANGED,
            admin_id=admin_id,
            setting_name=setting_name,
            old_value=str(old_value),
            new_value=str(new_value),
        )

    # System Events
    def log_system_startup(self, version: str = None, environment: str = None):
        """Log system startup."""
        self.log_event(
            EventType.SYSTEM_STARTUP, version=version, environment=environment
        )

    def log_system_error(
        self,
        error_type: str,
        error_message: str,
        component: str = None,
        user_id: str = None,
    ):
        """Log system errors."""
        self.log_event(
            EventType.SYSTEM_ERROR,
            error_type=error_type,
            error_message=error_message,
            component=component,
            user_id=user_id,
        )


# Global instance for easy access throughout the application
business_logger = BusinessEventLogger()


# Convenience functions for common events
def log_user_registered(user_id: str, email: str, registration_method: str = "web"):
    """Convenience function to log user registration."""
    business_logger.log_user_registered(user_id, email, registration_method)


def log_booking_created(
    user_id: str,
    class_id: str,
    booking_id: str,
    credits_used: int,
    booking_method: str = "web",
):
    """Convenience function to log booking creation."""
    business_logger.log_booking_created(
        user_id, class_id, booking_id, credits_used, booking_method
    )


def log_payment_success(
    user_id: str,
    payment_id: str,
    amount: float,
    currency: str,
    payment_method: str,
    stripe_payment_id: str = None,
):
    """Convenience function to log successful payment."""
    business_logger.log_payment_success(
        user_id, payment_id, amount, currency, payment_method, stripe_payment_id
    )


def log_admin_action(
    admin_id: str,
    action: str,
    target_type: str,
    target_id: str,
    details: Dict[str, Any] = None,
):
    """Convenience function to log admin actions."""
    business_logger.log_admin_action(admin_id, action, target_type, target_id, details)
