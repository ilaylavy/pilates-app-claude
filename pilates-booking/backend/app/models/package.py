import enum
from datetime import datetime, timedelta, timezone

from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        Numeric, String, Text, CheckConstraint)
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
    AUTHORIZED = "authorized"  # Admin authorized credit usage, payment pending
    PAYMENT_CONFIRMED = "payment_confirmed"  # Payment received and confirmed
    APPROVED = "approved"  # Legacy status for backward compatibility
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


class ApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    IN_REVIEW = "in_review"
    AUTHORIZED = "authorized"  # Admin authorized credit usage
    PAYMENT_CONFIRMED = "payment_confirmed"  # Payment confirmed, fully active
    REJECTED = "rejected"
    EXPIRED = "expired"


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
    payment_status = Column(Enum(PaymentStatus, name='userpackagepaymentstatus', values_callable=lambda x: [e.value for e in x]), default=PaymentStatus.PENDING_APPROVAL, nullable=False)
    payment_method = Column(Enum(PaymentMethod, name='paymentmethod', values_callable=lambda x: [e.value for e in x]), default=PaymentMethod.CREDIT_CARD, nullable=False)
    
    # Two-step approval tracking
    authorized_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    authorized_at = Column(DateTime(timezone=True), nullable=True)
    payment_confirmed_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    payment_confirmed_at = Column(DateTime(timezone=True), nullable=True)
    payment_confirmation_reference = Column(String, nullable=True)
    
    # Legacy field for backward compatibility
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    
    rejection_reason = Column(Text, nullable=True)
    payment_reference = Column(String, nullable=True)
    admin_notes = Column(Text, nullable=True)
    
    # Optimistic locking and audit fields
    version = Column(Integer, default=1, nullable=False)
    approval_deadline = Column(DateTime(timezone=True), nullable=True)
    approval_status = Column(Enum(ApprovalStatus, name='approvalstatus', values_callable=lambda x: [e.value for e in x]), default=ApprovalStatus.PENDING, nullable=False)
    idempotency_key = Column(String, nullable=True, unique=True)
    last_approval_attempt_at = Column(DateTime(timezone=True), nullable=True)
    approval_attempt_count = Column(Integer, default=0, nullable=False)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    user = relationship("User", back_populates="user_packages", foreign_keys="UserPackage.user_id")
    package = relationship("Package", back_populates="user_packages")
    
    # Two-step approval relationships
    authorizing_admin = relationship("User", foreign_keys="UserPackage.authorized_by")
    payment_confirming_admin = relationship("User", foreign_keys="UserPackage.payment_confirmed_by")
    
    # Legacy relationship for backward compatibility
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
        """Check if package can be used for bookings."""
        return (
            self.is_active
            and not self.is_expired
            and not self.is_reservation_expired
            and self.status == UserPackageStatus.ACTIVE
            and self.payment_status in [PaymentStatus.AUTHORIZED, PaymentStatus.PAYMENT_CONFIRMED]
            and self.approval_status in [ApprovalStatus.AUTHORIZED, ApprovalStatus.PAYMENT_CONFIRMED]
            and (self.credits_remaining > 0 or self.package.is_unlimited)
        )
        
    @property
    def is_payment_pending(self) -> bool:
        """Check if package is authorized but payment not yet confirmed."""
        return (
            self.payment_status == PaymentStatus.AUTHORIZED
            and self.approval_status == ApprovalStatus.AUTHORIZED
        )
        
    @property
    def is_fully_confirmed(self) -> bool:
        """Check if package is fully confirmed and can move to history."""
        return (
            self.payment_status == PaymentStatus.PAYMENT_CONFIRMED
            and self.approval_status == ApprovalStatus.PAYMENT_CONFIRMED
        )
        
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
        """Check if package payment is approved (legacy compatibility)."""
        return self.payment_status in (
            PaymentStatus.APPROVED,  # Legacy status
            PaymentStatus.PAYMENT_CONFIRMED  # New two-step status
        )

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

    def activate_from_reservation(self) -> tuple[bool, str]:
        """Activate a reserved package after cash payment. Returns (success, message)."""
        if self.status != UserPackageStatus.RESERVED:
            return False, f"Package is not reserved (current status: {self.status.value})"
        
        if self.is_reservation_expired:
            return False, "Reservation has expired and cannot be activated"
            
        # Check for either legacy APPROVED or new PAYMENT_CONFIRMED status
        if self.payment_status not in (PaymentStatus.APPROVED, PaymentStatus.PAYMENT_CONFIRMED):
            return False, f"Payment must be approved first (current status: {self.payment_status.value})"
            
        self.status = UserPackageStatus.ACTIVE
        self.reservation_expires_at = None
        self.version += 1
        return True, "Package activated successfully"

    def cancel_reservation(self) -> tuple[bool, str]:
        """Cancel a reserved package. Returns (success, message)."""
        if self.status != UserPackageStatus.RESERVED:
            return False, f"Package is not reserved (current status: {self.status.value})"
            
        self.status = UserPackageStatus.CANCELLED
        self.approval_status = ApprovalStatus.REJECTED
        self.version += 1
        return True, "Reservation cancelled successfully"

    def authorize_payment(self, admin_id: int, payment_reference: str = None, admin_notes: str = None, expected_version: int = None) -> tuple[bool, str]:
        """Authorize payment - Step 1 of two-step approval. Returns (success, message)."""
        # Check optimistic lock
        if expected_version is not None and self.version != expected_version:
            return False, f"Package was modified by another admin. Expected version {expected_version}, current version {self.version}"
            
        # Validate current state
        if self.payment_status != PaymentStatus.PENDING_APPROVAL:
            return False, f"Package is not pending approval (current status: {self.payment_status.value})"
            
        if self.approval_status == ApprovalStatus.AUTHORIZED:
            return False, "Package is already authorized"
            
        if self.approval_status == ApprovalStatus.PAYMENT_CONFIRMED:
            return False, "Package payment is already confirmed"
            
        if self.approval_status == ApprovalStatus.REJECTED:
            return False, "Package was already rejected"
            
        # Check if approval deadline has passed
        if self.approval_deadline and datetime.now(timezone.utc) > self.approval_deadline:
            self.approval_status = ApprovalStatus.EXPIRED
            return False, "Approval deadline has passed"
            
        # Check reservation expiry for RESERVED packages
        if self.status == UserPackageStatus.RESERVED and self.is_reservation_expired:
            return False, "Reservation has expired and cannot be authorized"
            
        # Authorize the payment (Step 1)
        self.payment_status = PaymentStatus.AUTHORIZED
        self.approval_status = ApprovalStatus.AUTHORIZED
        self.authorized_by = admin_id
        self.authorized_at = datetime.now(timezone.utc)
        self.version += 1
        self.approval_attempt_count += 1
        self.last_approval_attempt_at = datetime.now(timezone.utc)
        
        if payment_reference:
            self.payment_reference = payment_reference
        if admin_notes:
            self.admin_notes = admin_notes
            
        return True, "Payment authorized successfully - user can now use credits"
        
    def confirm_payment(self, admin_id: int, confirmation_reference: str = None, admin_notes: str = None, expected_version: int = None) -> tuple[bool, str]:
        """Confirm payment received - Step 2 of two-step approval. Returns (success, message)."""
        # Check optimistic lock
        if expected_version is not None and self.version != expected_version:
            return False, f"Package was modified by another admin. Expected version {expected_version}, current version {self.version}"
            
        # Validate current state
        if self.payment_status != PaymentStatus.AUTHORIZED:
            return False, f"Package is not authorized (current status: {self.payment_status.value})"
            
        if self.approval_status != ApprovalStatus.AUTHORIZED:
            return False, f"Package approval status is not authorized (current status: {self.approval_status.value})"
            
        if not self.is_active or self.is_expired:
            return False, "Package is not active or has expired"
            
        # Confirm the payment (Step 2)
        self.payment_status = PaymentStatus.PAYMENT_CONFIRMED
        self.approval_status = ApprovalStatus.PAYMENT_CONFIRMED
        self.payment_confirmed_by = admin_id
        self.payment_confirmed_at = datetime.now(timezone.utc)
        self.version += 1
        self.approval_attempt_count += 1
        self.last_approval_attempt_at = datetime.now(timezone.utc)
        
        if confirmation_reference:
            self.payment_confirmation_reference = confirmation_reference
        if admin_notes:
            self.admin_notes = admin_notes
            
        # Set legacy fields for backward compatibility
        self.approved_by = admin_id
        self.approved_at = self.payment_confirmed_at
            
        return True, "Payment confirmed successfully - package is now fully active"
        
    def revoke_authorization(self, admin_id: int, revocation_reason: str, admin_notes: str = None, expected_version: int = None) -> tuple[bool, str]:
        """Revoke an authorized payment. Returns (success, message)."""
        # Check optimistic lock
        if expected_version is not None and self.version != expected_version:
            return False, f"Package was modified by another admin. Expected version {expected_version}, current version {self.version}"
            
        # Validate current state
        if self.payment_status != PaymentStatus.AUTHORIZED:
            return False, f"Package is not authorized (current status: {self.payment_status.value})"
            
        if self.approval_status != ApprovalStatus.AUTHORIZED:
            return False, f"Package approval status is not authorized (current status: {self.approval_status.value})"
            
        # Validate revocation reason
        if not revocation_reason or not revocation_reason.strip():
            return False, "Revocation reason is required"
            
        # Revoke the authorization
        self.payment_status = PaymentStatus.REJECTED
        self.approval_status = ApprovalStatus.REJECTED
        self.approved_by = admin_id  # Use legacy field
        self.approved_at = datetime.now(timezone.utc)
        self.rejection_reason = revocation_reason.strip()
        self.version += 1
        self.approval_attempt_count += 1
        self.last_approval_attempt_at = datetime.now(timezone.utc)
        
        if admin_notes:
            self.admin_notes = admin_notes.strip()
            
        return True, "Authorization revoked successfully"
        
    # Keep original method for backward compatibility
    def approve_payment(self, admin_id: int, payment_reference: str = None, admin_notes: str = None, expected_version: int = None) -> tuple[bool, str]:
        """Legacy method - now does full approval in one step for backward compatibility."""
        # First authorize
        success, message = self.authorize_payment(admin_id, payment_reference, admin_notes, expected_version)
        if not success:
            return False, message
            
        # Then immediately confirm payment
        success, message = self.confirm_payment(admin_id, payment_reference, admin_notes, self.version)
        if not success:
            return False, f"Authorization succeeded but confirmation failed: {message}"
            
        return True, "Payment approved and confirmed successfully"

    def reject_payment(self, admin_id: int, rejection_reason: str, admin_notes: str = None, expected_version: int = None) -> tuple[bool, str]:
        """Reject a pending payment with optimistic locking. Returns (success, message)."""
        # Check optimistic lock
        if expected_version is not None and self.version != expected_version:
            return False, f"Package was modified by another admin. Expected version {expected_version}, current version {self.version}"
            
        # Validate current state
        if self.payment_status != PaymentStatus.PENDING_APPROVAL:
            return False, f"Package is not pending approval (current status: {self.payment_status.value})"
            
        if self.approval_status == ApprovalStatus.APPROVED:
            return False, "Package is already approved"
            
        if self.approval_status == ApprovalStatus.REJECTED:
            return False, "Package was already rejected"
            
        # Validate rejection reason
        if not rejection_reason or not rejection_reason.strip():
            return False, "Rejection reason is required"
            
        # Reject the payment
        self.payment_status = PaymentStatus.REJECTED
        self.approval_status = ApprovalStatus.REJECTED
        self.approved_by = admin_id
        self.approved_at = datetime.now(timezone.utc)
        self.rejection_reason = rejection_reason.strip()
        self.version += 1
        self.approval_attempt_count += 1
        self.last_approval_attempt_at = datetime.now(timezone.utc)
        
        if admin_notes:
            self.admin_notes = admin_notes.strip()
            
        return True, "Payment rejected successfully"

    def set_in_review(self, admin_id: int) -> tuple[bool, str]:
        """Mark package as being reviewed by admin. Returns (success, message)."""
        if self.approval_status != ApprovalStatus.PENDING:
            return False, f"Package is not pending review (current status: {self.approval_status.value})"
            
        self.approval_status = ApprovalStatus.IN_REVIEW
        self.last_approval_attempt_at = datetime.now(timezone.utc)
        self.version += 1
        return True, "Package marked as in review"

    def generate_idempotency_key(self) -> str:
        """Generate a unique idempotency key for this package."""
        from uuid import uuid4
        self.idempotency_key = f"pkg_{self.id}_{uuid4().hex[:8]}"
        return self.idempotency_key

    @property
    def can_be_approved(self) -> bool:
        """Check if package can be approved based on current state."""
        return (
            self.payment_status == PaymentStatus.PENDING_APPROVAL
            and self.approval_status in [ApprovalStatus.PENDING, ApprovalStatus.IN_REVIEW]
            and (not self.approval_deadline or datetime.now(timezone.utc) <= self.approval_deadline)
            and (self.status != UserPackageStatus.RESERVED or not self.is_reservation_expired)
        )
        
    @property
    def can_be_authorized(self) -> bool:
        """Check if package can be authorized (step 1 of approval)."""
        return self.can_be_approved  # Same logic as original approval
        
    @property
    def can_confirm_payment(self) -> bool:
        """Check if package payment can be confirmed (step 2 of approval)."""
        return (
            self.payment_status == PaymentStatus.AUTHORIZED
            and self.approval_status == ApprovalStatus.AUTHORIZED
            and self.is_active
            and not self.is_expired
        )
        
    @property
    def can_be_revoked(self) -> bool:
        """Check if authorized package can be revoked."""
        return (
            self.payment_status == PaymentStatus.AUTHORIZED
            and self.approval_status == ApprovalStatus.AUTHORIZED
        )

    @property
    def approval_timeout_hours(self) -> int:
        """Get hours until approval deadline."""
        if not self.approval_deadline:
            return -1
        delta = self.approval_deadline - datetime.now(timezone.utc)
        return max(0, int(delta.total_seconds() / 3600))

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


class PaymentApproval(Base):
    __tablename__ = "payment_approvals"

    id = Column(Integer, primary_key=True, index=True)
    user_package_id = Column(Integer, ForeignKey("user_packages.id"), nullable=False)
    requested_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    admin_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    action = Column(Enum(PaymentApprovalAction, name='paymentapprovalaction', values_callable=lambda x: [e.value for e in x]), nullable=False)
    action_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    notes = Column(Text, nullable=True)
    
    # Enhanced audit fields
    package_version_at_approval = Column(Integer, nullable=True)
    failure_reason = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)  # IPv6 support
    user_agent = Column(Text, nullable=True)
    previous_status = Column(String, nullable=True)
    approval_duration_seconds = Column(Integer, nullable=True)
    is_bulk_operation = Column(Boolean, default=False, nullable=False)
    bulk_operation_id = Column(String, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    user_package = relationship("UserPackage")
    admin = relationship("User", foreign_keys="PaymentApproval.admin_id")

    @classmethod
    def create_approval_record(cls, user_package, admin_id: int, action: PaymentApprovalAction, 
                              notes: str = None, ip_address: str = None, user_agent: str = None,
                              approval_duration_seconds: int = None):
        """Create a comprehensive approval audit record."""
        return cls(
            user_package_id=user_package.id,
            admin_id=admin_id,
            action=action,
            notes=notes,
            package_version_at_approval=user_package.version,
            ip_address=ip_address,
            user_agent=user_agent,
            previous_status=user_package.approval_status.value,
            approval_duration_seconds=approval_duration_seconds
        )

    def __repr__(self):
        return f"<PaymentApproval(id={self.id}, user_package_id={self.user_package_id}, action={self.action})>"
