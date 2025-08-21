import enum
from datetime import datetime, timedelta, timezone

from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        Numeric, String, Text)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class UserPackageStatus(str, enum.Enum):
    ACTIVE = "active"
    RESERVED = "reserved"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class Package(Base):
    __tablename__ = "packages"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    credits = Column(Integer, nullable=False)  # Number of classes included
    price = Column(Numeric(10, 2), nullable=False)
    validity_days = Column(Integer, nullable=False)  # Days until expiration
    is_active = Column(Boolean, default=True, nullable=False)
    is_unlimited = Column(
        Boolean, default=False, nullable=False
    )  # For unlimited packages
    order_index = Column(Integer, default=0, nullable=False)  # For ordering packages
    is_featured = Column(
        Boolean, default=False, nullable=False
    )  # For highlighting packages
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user_packages = relationship(
        "UserPackage", back_populates="package", cascade="all, delete-orphan"
    )

    def __repr__(self):
        return f"<Package(id={self.id}, name='{self.name}', credits={self.credits})>"


class UserPackage(Base):
    __tablename__ = "user_packages"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=False)
    credits_remaining = Column(Integer, nullable=False)
    purchase_date = Column(DateTime(timezone=True), server_default=func.now())
    expiry_date = Column(DateTime(timezone=True), nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    status = Column(Enum(UserPackageStatus), default=UserPackageStatus.ACTIVE, nullable=False)
    reservation_expires_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="user_packages")
    package = relationship("Package", back_populates="user_packages")

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expiry_date

    @property
    def is_reservation_expired(self) -> bool:
        return (
            self.status == UserPackageStatus.RESERVED
            and self.reservation_expires_at
            and datetime.now(timezone.utc) > self.reservation_expires_at
        )

    @property
    def is_valid(self) -> bool:
        return (
            self.is_active
            and not self.is_expired
            and not self.is_reservation_expired
            and self.status == UserPackageStatus.ACTIVE
            and (self.credits_remaining > 0 or self.package.is_unlimited)
        )

    @property
    def is_reserved(self) -> bool:
        return (
            self.status == UserPackageStatus.RESERVED
            and not self.is_reservation_expired
        )

    @property
    def days_until_expiry(self) -> int:
        if self.is_expired:
            return 0
        return (self.expiry_date - datetime.now(timezone.utc)).days

    def use_credit(self) -> bool:
        """Use one credit from this package. Returns True if successful."""
        if not self.is_valid:
            return False

        if not self.package.is_unlimited:
            if self.credits_remaining <= 0:
                return False
            self.credits_remaining -= 1

        return True

    def refund_credit(self) -> bool:
        """Refund one credit to this package. Returns True if successful."""
        if not self.package.is_unlimited:
            self.credits_remaining += 1
        return True

    def activate_from_reservation(self) -> bool:
        """Activate a reserved package after cash payment. Returns True if successful."""
        if self.status != UserPackageStatus.RESERVED:
            return False
        
        if self.is_reservation_expired:
            return False
            
        self.status = UserPackageStatus.ACTIVE
        self.reservation_expires_at = None
        return True

    def cancel_reservation(self) -> bool:
        """Cancel a reserved package. Returns True if successful."""
        if self.status != UserPackageStatus.RESERVED:
            return False
            
        self.status = UserPackageStatus.CANCELLED
        return True

    def __repr__(self):
        return f"<UserPackage(id={self.id}, user_id={self.user_id}, credits={self.credits_remaining})>"
