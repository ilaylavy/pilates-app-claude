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


class PaymentStatus(str, enum.Enum):
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class PaymentMethod(str, enum.Enum):
    CASH = "CASH"
    CREDIT_CARD = "CREDIT_CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    PAYPAL = "PAYPAL"
    STRIPE = "STRIPE"


class PaymentApprovalAction(str, enum.Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


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
    reservation_expires_at = Column(DateTime(timezone=True), nullable=True)
    
    # Payment tracking fields
    payment_status = Column(Enum(PaymentStatus, name='userpackagepaymentstatus', values_callable=lambda x: [e.value for e in x]), default=PaymentStatus.APPROVED, nullable=False)
    payment_method = Column(Enum(PaymentMethod, name='paymentmethod', values_callable=lambda x: [e.value for e in x]), default=PaymentMethod.CREDIT_CARD, nullable=False)
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
            and self.payment_status == PaymentStatus.APPROVED
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

    @property
    def is_pending_approval(self) -> bool:
        """Check if package is pending payment approval."""
        return self.payment_status == PaymentStatus.PENDING_APPROVAL

    @property
    def is_approved(self) -> bool:
        """Check if package payment is approved."""
        return self.payment_status == PaymentStatus.APPROVED

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

    def activate_from_reservation(self) -> bool:
        """Activate a reserved package after cash payment. Returns True if successful."""
        if self.status != UserPackageStatus.RESERVED:
            return False
        
        if self.is_reservation_expired:
            return False
            
        self.status = UserPackageStatus.ACTIVE
        self.payment_status = PaymentStatus.APPROVED
        self.reservation_expires_at = None
        return True

    def cancel_reservation(self) -> bool:
        """Cancel a reserved package. Returns True if successful."""
        if self.status != UserPackageStatus.RESERVED:
            return False
            
        self.status = UserPackageStatus.CANCELLED
        return True

    def approve_payment(self, admin_id: int, payment_reference: str = None, admin_notes: str = None) -> bool:
        """Approve a pending payment. Returns True if successful."""
        if self.payment_status != PaymentStatus.PENDING_APPROVAL:
            return False
            
        self.payment_status = PaymentStatus.APPROVED
        self.approved_by = admin_id
        self.approved_at = datetime.now(timezone.utc)
        if payment_reference:
            self.payment_reference = payment_reference
        if admin_notes:
            self.admin_notes = admin_notes
        return True

    def reject_payment(self, admin_id: int, rejection_reason: str, admin_notes: str = None) -> bool:
        """Reject a pending payment. Returns True if successful."""
        if self.payment_status != PaymentStatus.PENDING_APPROVAL:
            return False
            
        self.payment_status = PaymentStatus.REJECTED
        self.approved_by = admin_id
        self.approved_at = datetime.now(timezone.utc)
        self.rejection_reason = rejection_reason
        if admin_notes:
            self.admin_notes = admin_notes
        return True

    def __repr__(self):
        return f"<UserPackage(id={self.id}, user_id={self.user_id}, credits={self.credits_remaining})>"


class PaymentApproval(Base):
    __tablename__ = "payment_approvals"

    id = Column(Integer, primary_key=True, index=True)
    user_package_id = Column(Integer, ForeignKey("user_packages.id"), nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Enum(PaymentApprovalAction, name='paymentapprovalaction', values_callable=lambda x: [e.value for e in x]), nullable=False)
    action_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user_package = relationship("UserPackage")
    admin = relationship("User", foreign_keys="PaymentApproval.admin_id")

    def __repr__(self):
        return f"<PaymentApproval(id={self.id}, user_package_id={self.user_package_id}, action={self.action})>"
