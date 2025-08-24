import enum
from datetime import datetime, timedelta, timezone

from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        Numeric, String, Text, CheckConstraint)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class UserPackageStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"        # Cash payment not yet confirmed by admin
    CONFIRMED = "confirmed"    # Payment received and confirmed
    REJECTED = "rejected"      # Payment rejected/refunded


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CREDIT_CARD = "CREDIT_CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    PAYPAL = "PAYPAL"
    STRIPE = "STRIPE"


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
    status = Column(Enum(UserPackageStatus, name='userpackagestatus', values_callable=lambda x: [e.value for e in x]), default=UserPackageStatus.ACTIVE, nullable=False)
    
    # Payment tracking fields
    payment_status = Column(Enum(PaymentStatus, name='userpackagepaymentstatus', values_callable=lambda x: [e.value for e in x]), default=PaymentStatus.CONFIRMED, nullable=False)
    payment_method = Column(Enum(PaymentMethod, name='paymentmethod', values_callable=lambda x: [e.value for e in x]), default=PaymentMethod.CREDIT_CARD, nullable=False)
    
    # Simple approval fields
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    payment_reference = Column(String, nullable=True)
    admin_notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="user_packages", foreign_keys="UserPackage.user_id")
    package = relationship("Package", back_populates="user_packages")
    approving_admin = relationship("User", foreign_keys="UserPackage.approved_by")

    @property
    def is_expired(self) -> bool:
        return datetime.now(timezone.utc) > self.expiry_date

    @property
    def is_valid(self) -> bool:
        """Check if package can be used for bookings."""
        return (
            self.is_active
            and not self.is_expired
            and self.status == UserPackageStatus.ACTIVE
            and (self.credits_remaining > 0 or self.package.is_unlimited)
        )
        
    @property
    def is_payment_pending(self) -> bool:
        """Check if package payment is pending admin confirmation."""
        return self.payment_status == PaymentStatus.PENDING

    @property
    def is_historical(self) -> bool:
        """Check if package should be shown in history (completed lifecycle)."""
        # Rejected packages go to history
        if self.payment_status == PaymentStatus.REJECTED:
            return True
            
        # Expired packages go to history regardless of credits
        if self.is_expired:
            return True
            
        # Fully used packages (no credits left) go to history if they're not unlimited
        if not self.package.is_unlimited and self.credits_remaining <= 0:
            return True
            
        # Cancelled packages go to history
        if self.status == UserPackageStatus.CANCELLED:
            return True
            
        return False

    @property
    def days_until_expiry(self) -> int:
        if self.is_expired:
            return 0
        return (self.expiry_date - datetime.now(timezone.utc)).days

    @property
    def is_pending_approval(self) -> bool:
        """Check if package is pending payment approval."""
        return self.payment_status == PaymentStatus.PENDING

    @property
    def is_approved(self) -> bool:
        """Check if package payment is confirmed."""
        return self.payment_status == PaymentStatus.CONFIRMED

    @property
    def is_rejected(self) -> bool:
        """Check if package payment is rejected."""
        return self.payment_status == PaymentStatus.REJECTED

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

    def confirm_payment(self, admin_id: int, payment_reference: str = None, admin_notes: str = None) -> tuple[bool, str]:
        """Confirm cash payment. Returns (success, message)."""
        if self.payment_status == PaymentStatus.CONFIRMED:
            return False, "Payment is already confirmed"
            
        if self.payment_status == PaymentStatus.REJECTED:
            return False, "Payment was rejected and cannot be confirmed"
            
        self.payment_status = PaymentStatus.CONFIRMED
        self.approved_by = admin_id
        self.approved_at = datetime.now(timezone.utc)
        
        if payment_reference:
            self.payment_reference = payment_reference
        if admin_notes:
            self.admin_notes = admin_notes
            
        return True, "Payment confirmed successfully"

    def reject_payment(self, admin_id: int, rejection_reason: str, admin_notes: str = None) -> tuple[bool, str]:
        """Reject a pending payment. Returns (success, message)."""
        if self.payment_status == PaymentStatus.CONFIRMED:
            return False, "Payment is already confirmed and cannot be rejected"
            
        if self.payment_status == PaymentStatus.REJECTED:
            return False, "Payment is already rejected"
            
        if not rejection_reason or not rejection_reason.strip():
            return False, "Rejection reason is required"
            
        self.payment_status = PaymentStatus.REJECTED
        self.approved_by = admin_id
        self.approved_at = datetime.now(timezone.utc)
        self.rejection_reason = rejection_reason.strip()
        
        if admin_notes:
            self.admin_notes = admin_notes.strip()
            
        return True, "Payment rejected successfully"

    def __repr__(self):
        try:
            # Safe access to attributes that might require database access
            package_id = getattr(self, 'id', 'unknown')
            user_id = getattr(self, 'user_id', 'unknown') 
            credits = getattr(self, 'credits_remaining', 'unknown')
            return f"<UserPackage(id={package_id}, user_id={user_id}, credits={credits})>"
        except Exception:
            # Fallback for detached instances
            return f"<UserPackage(detached instance)>"