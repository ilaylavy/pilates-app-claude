import enum
from datetime import datetime
from typing import List, Optional

from sqlalchemy import JSON, Boolean, Column, DateTime, Integer, String, Text
from sqlalchemy.sql import func

from ..core.database import Base


class AnnouncementType(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    SUCCESS = "success"
    URGENT = "urgent"


class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    message = Column(Text, nullable=False)
    type = Column(String(20), default="info", nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    expires_at = Column(DateTime(timezone=True), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_dismissible = Column(Boolean, default=True, nullable=False)
    
    # Target roles - JSON array of roles ['student', 'instructor', 'admin']
    # If null, announcement is for all roles
    target_roles = Column(JSON, nullable=True)
    
    # Track who created the announcement
    created_by = Column(Integer, nullable=False)
    
    # Soft delete
    deleted_at = Column(DateTime(timezone=True), nullable=True)

    @property
    def is_expired(self) -> bool:
        """Check if announcement is expired"""
        if self.expires_at is None:
            return False
        return datetime.utcnow() > self.expires_at
    
    @property 
    def is_visible(self) -> bool:
        """Check if announcement should be visible"""
        return (
            self.is_active and 
            not self.is_expired and 
            self.deleted_at is None
        )
        
    def is_for_role(self, role: str) -> bool:
        """Check if announcement targets specific role"""
        if self.target_roles is None:
            return True  # Announcement for all roles
        return role in self.target_roles