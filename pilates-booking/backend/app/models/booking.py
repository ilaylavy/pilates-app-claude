from sqlalchemy import Column, Integer, ForeignKey, DateTime, Enum, Text, Boolean
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
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
    class_instance_id = Column(Integer, ForeignKey("class_instances.id"), nullable=False)
    user_package_id = Column(Integer, ForeignKey("user_packages.id"), nullable=True)
    status = Column(Enum(BookingStatus), default=BookingStatus.CONFIRMED)
    booking_date = Column(DateTime(timezone=True), server_default=func.now())
    cancellation_date = Column(DateTime(timezone=True), nullable=True)
    cancellation_reason = Column(Enum(CancellationReason), nullable=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="bookings")
    class_instance = relationship("ClassInstance", back_populates="bookings")
    user_package = relationship("UserPackage")

    @property
    def can_cancel(self) -> bool:
        """Check if booking can be cancelled based on business rules."""
        if self.status != BookingStatus.CONFIRMED:
            return False
        
        from datetime import datetime, timedelta
        from ..core.config import settings
        
        cancellation_deadline = self.class_instance.start_datetime - timedelta(
            hours=settings.CANCELLATION_HOURS_LIMIT
        )
        return datetime.utcnow() < cancellation_deadline

    def __repr__(self):
        return f"<Booking(id={self.id}, user_id={self.user_id}, class_id={self.class_instance_id}, status='{self.status}')>"


class WaitlistEntry(Base):
    __tablename__ = "waitlist_entries"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    class_instance_id = Column(Integer, ForeignKey("class_instances.id"), nullable=False)
    position = Column(Integer, nullable=False)
    joined_date = Column(DateTime(timezone=True), server_default=func.now())
    notified_date = Column(DateTime(timezone=True), nullable=True)
    promoted_date = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="waitlist_entries")
    class_instance = relationship("ClassInstance", back_populates="waitlist_entries")

    def __repr__(self):
        return f"<WaitlistEntry(id={self.id}, user_id={self.user_id}, class_id={self.class_instance_id}, position={self.position})>"