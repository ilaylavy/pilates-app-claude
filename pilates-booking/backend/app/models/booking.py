import enum

from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        Text)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class BookingStatus(str, enum.Enum):
    CONFIRMED = "confirmed"
    CANCELLED = "cancelled"
    NO_SHOW = "no_show"
    COMPLETED = "completed"


class CancellationReason(str, enum.Enum):
    USER_CANCELLED = "user_cancelled"
    CLASS_CANCELLED = "class_cancelled"
    NO_SHOW = "no_show"
    ADMIN_CANCELLED = "admin_cancelled"


class Booking(Base):
    __tablename__ = "bookings"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_instance_id = Column(
        Integer, ForeignKey("class_instances.id"), nullable=False
    )
    user_package_id = Column(Integer, ForeignKey("user_packages.id"), nullable=True)
    status = Column(Enum(BookingStatus), default=BookingStatus.CONFIRMED)
    booking_date = Column(DateTime(timezone=True), server_default=func.now())
    cancellation_date = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Enum(CancellationReason), nullable=True)
    notes = Column(Text, nullable=True)
    version = Column(Integer, nullable=False, default=1, server_default="1")  # For optimistic locking
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="bookings")
    class_instance = relationship("ClassInstance", back_populates="bookings")
    user_package = relationship("UserPackage")

    @property  
    def can_cancel(self) -> bool:
        """Property that safely checks if booking can be cancelled."""
        try:
            return self._can_cancel_internal()
        except Exception:
            return False
    
    def _can_cancel_internal(self) -> bool:
        """Internal method for cancellation logic."""
        if self.status != BookingStatus.CONFIRMED:
            return False

        from datetime import datetime, timedelta, timezone

        from ..core.config import settings

        # Only access class_instance if it's loaded
        if (
            not hasattr(self, "_sa_instance_state")
            or not self._sa_instance_state.expired
        ):
            if hasattr(self, "class_instance") and self.class_instance:
                cancellation_deadline = self.class_instance.start_datetime - timedelta(
                    hours=settings.CANCELLATION_HOURS_LIMIT
                )
                return datetime.now(timezone.utc) < cancellation_deadline

        # Fallback - assume cannot cancel if we can't check
        return False

    def __repr__(self):
        # Use try-except for everything to prevent DetachedInstanceError
        try:
            booking_id = self.id
        except Exception:
            booking_id = "unknown"
            
        try:
            user_id = self.user_id
        except Exception:
            user_id = "unknown"
            
        try:
            class_id = self.class_instance_id
        except Exception:
            class_id = "unknown"
            
        try:
            status = self.status
        except Exception:
            status = "unknown"
            
        return f"<Booking(id={booking_id}, user_id={user_id}, class_id={class_id}, status='{status}')>"


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_instance_id = Column(
        Integer, ForeignKey("class_instances.id"), nullable=False
    )
    position = Column(Integer, nullable=False)
    joined_date = Column(DateTime(timezone=True), server_default=func.now())
    notified_date = Column(DateTime(timezone=True), nullable=True)
    promoted_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="waitlist_entries")
    class_instance = relationship("ClassInstance", back_populates="waitlist_entries")

    def __repr__(self):
        # Use try-except for everything to prevent DetachedInstanceError
        try:
            entry_id = self.id
        except Exception:
            entry_id = "unknown"
            
        try:
            user_id = self.user_id
        except Exception:
            user_id = "unknown"
            
        try:
            class_id = self.class_instance_id
        except Exception:
            class_id = "unknown"
            
        try:
            position = self.position
        except Exception:
            position = "unknown"
            
        return f"<WaitlistEntry(id={entry_id}, user_id={user_id}, class_id={class_id}, position={position})>"
