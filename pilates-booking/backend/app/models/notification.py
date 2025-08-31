import enum
from datetime import datetime
from typing import List, Optional, Dict, Any

from sqlalchemy import (
    JSON, Boolean, Column, DateTime, Enum, Integer, 
    String, Text, ForeignKey, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class NotificationType(str, enum.Enum):
    # Core booking and package notifications
    BOOKING_SUCCESS = "booking_success"
    BOOKING_CANCELLED = "booking_cancelled"
    PACKAGE_ACTIVATED = "package_activated"
    PAYMENT_PROCESSED = "payment_processed"
    PAYMENT_FAILED = "payment_failed"
    CLASS_REMINDER = "class_reminder"
    WAITLIST_PROMOTED = "waitlist_promoted"
    
    # Announcement types (for backward compatibility)
    ADMIN_ANNOUNCEMENT = "admin_announcement"
    URGENT_ANNOUNCEMENT = "urgent_announcement"
    GENERAL_ANNOUNCEMENT = "general_announcement"
    
    # System notifications
    SYSTEM_MAINTENANCE = "system_maintenance"
    ACCOUNT_VERIFIED = "account_verified"
    PASSWORD_RESET = "password_reset"


class NotificationPriority(str, enum.Enum):
    CRITICAL = "critical"  # System outages, payment failures
    HIGH = "high"          # Class cancellations, important announcements
    NORMAL = "normal"      # Booking confirmations, reminders
    LOW = "low"           # Tips, promotional content


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    type = Column(Enum(NotificationType), nullable=False)
    title = Column(String(200), nullable=False)
    body = Column(Text, nullable=False)
    data_json = Column(JSON, nullable=True)
    priority = Column(Enum(NotificationPriority), default=NotificationPriority.NORMAL, nullable=False)
    
    # Temporal fields
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    archived_at = Column(DateTime(timezone=True), nullable=True)
    deleted_at = Column(DateTime(timezone=True), nullable=True)
    
    # Source tracking (your enhancement #1)
    source_type = Column(String(50), nullable=True)  # 'booking', 'payment', 'class', 'announcement'
    source_id = Column(Integer, nullable=True)        # Reference to booking_id, payment_id, etc.
    extra_data = Column(JSON, nullable=True)          # For future extensibility (renamed from metadata)
    
    # Broadcasting
    sender_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    is_broadcast = Column(Boolean, default=False, nullable=False)

    # Relationships
    user = relationship("User", back_populates="notifications", foreign_keys=[user_id])
    sender = relationship("User", foreign_keys=[sender_id])
    notification_reads = relationship("NotificationRead", back_populates="notification", cascade="all, delete-orphan")
    push_deliveries = relationship("PushDelivery", back_populates="notification", cascade="all, delete-orphan")

    # Indexes for performance
    __table_args__ = (
        Index('idx_notifications_user_id', user_id),
        Index('idx_notifications_created_at', created_at),
        Index('idx_notifications_expires_at', expires_at),
        Index('idx_notifications_source', source_type, source_id),
        Index('idx_notifications_type_priority', type, priority),
    )

    @property
    def is_expired(self) -> bool:
        """Check if notification is expired"""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at

    @property
    def is_visible(self) -> bool:
        """Check if notification should be visible to user"""
        return (
            not self.is_expired and 
            self.deleted_at is None and
            self.archived_at is None
        )

    def is_read_by_user(self, user_id: int) -> bool:
        """Check if notification is read by specific user"""
        return any(nr.user_id == user_id and nr.read_at is not None 
                  for nr in self.notification_reads)

    def is_dismissed_by_user(self, user_id: int) -> bool:
        """Check if notification is dismissed by specific user"""
        return any(nr.user_id == user_id and nr.dismissed_at is not None 
                  for nr in self.notification_reads)


class NotificationRead(Base):
    __tablename__ = "notification_reads"

    id = Column(Integer, primary_key=True, index=True)
    notification_id = Column(Integer, ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    read_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=True)
    dismissed_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    notification = relationship("Notification", back_populates="notification_reads")
    user = relationship("User", back_populates="notification_reads")

    # Ensure unique read record per notification per user
    __table_args__ = (
        UniqueConstraint('notification_id', 'user_id', name='uq_notification_read_user'),
        Index('idx_notification_reads_user', user_id),
        Index('idx_notification_reads_notification', notification_id),
    )


class NotificationPreference(Base):
    __tablename__ = "notification_preferences"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    notification_type = Column(Enum(NotificationType), nullable=False)
    
    # Channel preferences
    channel_email = Column(Boolean, default=True, nullable=False)
    channel_push = Column(Boolean, default=True, nullable=False)
    channel_in_app = Column(Boolean, default=True, nullable=False)
    enabled = Column(Boolean, default=True, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    # Relationships
    user = relationship("User", back_populates="notification_preferences")

    # Ensure unique preference per user per type
    __table_args__ = (
        UniqueConstraint('user_id', 'notification_type', name='uq_user_notification_type'),
        Index('idx_notification_preferences_user', user_id),
    )


class NotificationTemplate(Base):
    __tablename__ = "notification_templates"

    id = Column(Integer, primary_key=True, index=True)
    type = Column(Enum(NotificationType), unique=True, nullable=False)
    
    # Multilingual templates
    title_en = Column(String(200), nullable=False)
    title_he = Column(String(200), nullable=False)
    body_en = Column(Text, nullable=False)
    body_he = Column(Text, nullable=False)
    
    # Template variables for substitution
    variables = Column(JSON, nullable=True)  # List of variable names like ["class_name", "date", "time"]
    
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

    __table_args__ = (
        Index('idx_notification_templates_type', type),
    )

    def get_title(self, language: str = 'en') -> str:
        """Get title in specified language"""
        return self.title_he if language == 'he' else self.title_en

    def get_body(self, language: str = 'en') -> str:
        """Get body in specified language"""
        return self.body_he if language == 'he' else self.body_en

    def render_title(self, language: str = 'en', **kwargs) -> str:
        """Render title with variable substitution"""
        title = self.get_title(language)
        return title.format(**kwargs) if kwargs else title

    def render_body(self, language: str = 'en', **kwargs) -> str:
        """Render body with variable substitution"""
        body = self.get_body(language)
        return body.format(**kwargs) if kwargs else body