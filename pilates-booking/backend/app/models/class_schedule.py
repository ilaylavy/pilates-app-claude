import enum

from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        String, Text, Time)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

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
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    class_instances = relationship(
        "ClassInstance", back_populates="template", cascade="all, delete-orphan"
    )

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
    actual_capacity = Column(
        Integer, nullable=True
    )  # Override template capacity if needed
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    template = relationship("ClassTemplate", back_populates="class_instances")
    instructor = relationship("User", back_populates="taught_classes")
    bookings = relationship(
        "Booking", back_populates="class_instance", cascade="all, delete-orphan"
    )
    waitlist_entries = relationship(
        "WaitlistEntry", back_populates="class_instance", cascade="all, delete-orphan"
    )

    @property
    def capacity(self) -> int:
        if self.actual_capacity:
            return self.actual_capacity
        try:
            # Check if template relationship is loaded
            if hasattr(self, '_sa_instance_state') and hasattr(self._sa_instance_state, 'attrs'):
                template_attr = self._sa_instance_state.attrs.get('template')
                if template_attr and template_attr.loaded_value is not None:
                    return self.template.capacity or 12
            # Fallback when template not loaded or session expired
            return 12
        except Exception:
            # Fallback in case of any SQLAlchemy errors
            return 12

    def get_available_spots(self) -> int:
        """Calculate available spots. Only call when bookings are loaded."""
        try:
            # Check if bookings relationship is loaded
            if hasattr(self, '_sa_instance_state') and hasattr(self._sa_instance_state, 'attrs'):
                booking_attr = self._sa_instance_state.attrs.get('bookings')
                if booking_attr and booking_attr.loaded_value is not None:
                    confirmed_bookings = len(
                        [b for b in self.bookings if b.status.value == "confirmed"]
                    )
                    return self.capacity - confirmed_bookings
            # Fallback when bookings not loaded or session expired
            return self.capacity
        except Exception:
            # Fallback in case of any SQLAlchemy errors
            return self.capacity

    def get_is_full(self) -> bool:
        """Check if class is full. Only call when bookings are loaded."""
        return self.get_available_spots() <= 0

    def get_waitlist_count(self) -> int:
        """Get the number of active waitlist entries. Only call when waitlist_entries are loaded."""
        try:
            # Check if waitlist_entries relationship is loaded
            if hasattr(self, '_sa_instance_state') and hasattr(self._sa_instance_state, 'attrs'):
                waitlist_attr = self._sa_instance_state.attrs.get('waitlist_entries')
                if waitlist_attr and waitlist_attr.loaded_value is not None:
                    return len([w for w in self.waitlist_entries if w.is_active])
            # Fallback when waitlist_entries not loaded or session expired
            return 0
        except Exception:
            # Fallback in case of any SQLAlchemy errors
            return 0

    def get_participant_count(self) -> int:
        """Get the number of confirmed participants. Only call when bookings are loaded."""
        try:
            # Check if bookings relationship is loaded
            if hasattr(self, '_sa_instance_state') and hasattr(self._sa_instance_state, 'attrs'):
                booking_attr = self._sa_instance_state.attrs.get('bookings')
                if booking_attr and booking_attr.loaded_value is not None:
                    return len([b for b in self.bookings if b.status.value == "confirmed"])
            # Fallback when bookings not loaded or session expired
            return 0
        except Exception:
            # Fallback in case of any SQLAlchemy errors
            return 0

    # Properties for Pydantic serialization that handle detached instances safely
    @property
    def available_spots(self) -> int:
        """Safe property for available spots."""
        return self.get_available_spots()
        
    @property
    def is_full(self) -> bool:
        """Safe property for is_full."""
        return self.get_is_full()
        
    @property
    def waitlist_count(self) -> int:
        """Safe property for waitlist count."""
        return self.get_waitlist_count()
        
    @property
    def participant_count(self) -> int:
        """Safe property for participant count."""
        return self.get_participant_count()

    def __repr__(self):
        # Use try-except for everything to prevent DetachedInstanceError
        try:
            instance_id = self.id
        except Exception:
            instance_id = "unknown"
            
        try:
            datetime_str = str(self.start_datetime)
        except Exception:
            datetime_str = "unknown"
            
        template_name = "unknown"
        try:
            # Check if template relationship is loaded
            if hasattr(self, '_sa_instance_state') and hasattr(self._sa_instance_state, 'attrs'):
                template_attr = self._sa_instance_state.attrs.get('template')
                if template_attr and hasattr(template_attr, 'loaded_value') and template_attr.loaded_value is not None:
                    template_name = self.template.name
        except Exception:
            pass
            
        return f"<ClassInstance(id={instance_id}, template='{template_name}', datetime='{datetime_str}')>"
