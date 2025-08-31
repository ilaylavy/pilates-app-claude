import enum
from datetime import datetime
from typing import Optional, Dict, Any

from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey, Index, JSON
from sqlalchemy.orm import relationship, Mapped, mapped_column
from sqlalchemy.sql import func

from ..core.database import Base

class DevicePlatform(str, enum.Enum):
    ANDROID = "android"
    IOS = "ios"

class PushDeliveryStatus(str, enum.Enum):
    SENT = "sent"
    DELIVERED = "delivered"
    FAILED = "failed"
    PENDING = "pending"

class DeviceToken(Base):
    """Device tokens for push notifications"""
    
    __tablename__ = "device_tokens"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    user_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("users.id", ondelete="CASCADE"), 
        nullable=False, 
        index=True
    )
    token: Mapped[str] = mapped_column(String(255), nullable=False)
    platform: Mapped[DevicePlatform] = mapped_column(String(10), nullable=False)
    app_version: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    device_info: Mapped[Optional[Dict[str, Any]]] = mapped_column(JSON, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    last_used_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    # Relationships
    user: Mapped["User"] = relationship("User", back_populates="device_tokens")
    push_deliveries: Mapped[list["PushDelivery"]] = relationship(
        "PushDelivery", 
        back_populates="device_token",
        cascade="all, delete-orphan"
    )
    
    # Indexes
    __table_args__ = (
        Index("idx_device_token_user_token", "user_id", "token", unique=True),
        Index("idx_device_token_user_platform_active", "user_id", "platform", "is_active"),
        Index("idx_device_token_platform_active", "platform", "is_active"),
    )
    
    def update_last_used(self):
        """Update last used timestamp"""
        self.last_used_at = func.now()
    
    def deactivate(self):
        """Mark token as inactive"""
        self.is_active = False
        self.updated_at = func.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "user_id": self.user_id,
            "token": self.token,
            "platform": self.platform,
            "app_version": self.app_version,
            "device_info": self.device_info,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "last_used_at": self.last_used_at.isoformat() if self.last_used_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class PushDelivery(Base):
    """Track push notification deliveries"""
    
    __tablename__ = "push_deliveries"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    notification_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("notifications.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    device_token_id: Mapped[int] = mapped_column(
        Integer, 
        ForeignKey("device_tokens.id", ondelete="CASCADE"), 
        nullable=False,
        index=True
    )
    fcm_message_id: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    status: Mapped[PushDeliveryStatus] = mapped_column(String(20), nullable=False)
    sent_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    failed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    retry_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, 
        server_default=func.now(), 
        onupdate=func.now()
    )
    
    # Relationships
    notification: Mapped["Notification"] = relationship("Notification", back_populates="push_deliveries")
    device_token: Mapped[DeviceToken] = relationship("DeviceToken", back_populates="push_deliveries")
    
    # Indexes
    __table_args__ = (
        Index("idx_push_delivery_notification_status", "notification_id", "status"),
        Index("idx_push_delivery_status_sent_at", "status", "sent_at"),
        Index("idx_push_delivery_token_status", "device_token_id", "status"),
    )
    
    def mark_sent(self, fcm_message_id: Optional[str] = None):
        """Mark delivery as sent"""
        self.status = PushDeliveryStatus.SENT
        self.sent_at = func.now()
        if fcm_message_id:
            self.fcm_message_id = fcm_message_id
        self.updated_at = func.now()
    
    def mark_delivered(self):
        """Mark delivery as delivered"""
        self.status = PushDeliveryStatus.DELIVERED
        self.delivered_at = func.now()
        self.updated_at = func.now()
    
    def mark_failed(self, error_message: str):
        """Mark delivery as failed"""
        self.status = PushDeliveryStatus.FAILED
        self.failed_at = func.now()
        self.error_message = error_message
        self.retry_count += 1
        self.updated_at = func.now()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary"""
        return {
            "id": self.id,
            "notification_id": self.notification_id,
            "device_token_id": self.device_token_id,
            "fcm_message_id": self.fcm_message_id,
            "status": self.status,
            "sent_at": self.sent_at.isoformat() if self.sent_at else None,
            "delivered_at": self.delivered_at.isoformat() if self.delivered_at else None,
            "failed_at": self.failed_at.isoformat() if self.failed_at else None,
            "error_message": self.error_message,
            "retry_count": self.retry_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }