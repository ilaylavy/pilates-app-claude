from sqlalchemy import Column, Integer, String, Time, Text, ForeignKey, DateTime, Boolean, Enum
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from ..core.database import Base


class WeekDay(str, enum.Enum):
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class ClassLevel(str, enum.Enum):
    BEGINNER = "beginner"
    INTERMEDIATE = "intermediate"
    ADVANCED = "advanced"
    ALL_LEVELS = "all_levels"


class ClassStatus(str, enum.Enum):
    SCHEDULED = "scheduled"
    CANCELLED = "cancelled"
    COMPLETED = "completed"


class ClassTemplate(Base):
    __tablename__ = "class_templates"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    duration_minutes = Column(Integer, nullable=False, default=60)
    capacity = Column(Integer, nullable=False, default=12)
    level = Column(Enum(ClassLevel), default=ClassLevel.ALL_LEVELS)
    day_of_week = Column(Enum(WeekDay), nullable=False)
    start_time = Column(Time, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    class_instances = relationship("ClassInstance", back_populates="template", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<ClassTemplate(id={self.id}, name='{self.name}', day='{self.day_of_week}')>"


class ClassInstance(Base):
    __tablename__ = "class_instances"

    id = Column(Integer, primary_key=True, index=True)
    template_id = Column(Integer, ForeignKey("class_templates.id"), nullable=False)
    instructor_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    start_datetime = Column(DateTime(timezone=True), nullable=False)
    end_datetime = Column(DateTime(timezone=True), nullable=False)
    status = Column(Enum(ClassStatus), default=ClassStatus.SCHEDULED)
    actual_capacity = Column(Integer, nullable=True)  # Override template capacity if needed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    template = relationship("ClassTemplate", back_populates="class_instances")
    instructor = relationship("User", back_populates="taught_classes")
    bookings = relationship("Booking", back_populates="class_instance", cascade="all, delete-orphan")
    waitlist_entries = relationship("WaitlistEntry", back_populates="class_instance", cascade="all, delete-orphan")

    @property
    def capacity(self) -> int:
        return self.actual_capacity or self.template.capacity

    def get_available_spots(self) -> int:
        """Calculate available spots. Only call when bookings are loaded."""
        if not hasattr(self, '_sa_instance_state') or not self._sa_instance_state.expired:
            confirmed_bookings = len([b for b in self.bookings if b.status.value == "confirmed"])
            return self.capacity - confirmed_bookings
        return self.capacity  # Fallback when bookings not loaded

    def get_is_full(self) -> bool:
        """Check if class is full. Only call when bookings are loaded."""
        return self.get_available_spots() <= 0

    def get_waitlist_count(self) -> int:
        """Get the number of active waitlist entries. Only call when waitlist_entries are loaded."""
        if not hasattr(self, '_sa_instance_state') or not self._sa_instance_state.expired:
            return len([w for w in self.waitlist_entries if w.is_active])
        return 0  # Fallback when waitlist_entries not loaded

    def get_participant_count(self) -> int:
        """Get the number of confirmed participants. Only call when bookings are loaded."""
        if not hasattr(self, '_sa_instance_state') or not self._sa_instance_state.expired:
            return len([b for b in self.bookings if b.status.value == "confirmed"])
        return 0  # Fallback when bookings not loaded

    def __repr__(self):
        return f"<ClassInstance(id={self.id}, template='{self.template.name}', datetime='{self.start_datetime}')>"