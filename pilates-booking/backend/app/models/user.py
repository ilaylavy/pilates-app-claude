import enum

from sqlalchemy import JSON, Boolean, Column, DateTime, Enum, Integer, String
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class UserRole(str, enum.Enum):
    STUDENT = "student"
    INSTRUCTOR = "instructor"
    ADMIN = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    first_name = Column(String, nullable=False)
    last_name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    role = Column(Enum(UserRole), default=UserRole.STUDENT, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    verification_token = Column(String, nullable=True)
    reset_token = Column(String, nullable=True)
    avatar_url = Column(String, nullable=True)
    preferences = Column(JSON, nullable=True)
    privacy_settings = Column(JSON, nullable=True)
    stripe_customer_id = Column(String, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )

    # Relationships
    bookings = relationship(
        "Booking", back_populates="user", cascade="all, delete-orphan"
    )
    waitlist_entries = relationship(
        "WaitlistEntry", back_populates="user", cascade="all, delete-orphan"
    )
    user_packages = relationship(
        "UserPackage", back_populates="user", cascade="all, delete-orphan",
        foreign_keys="UserPackage.user_id"
    )
    payments = relationship(
        "Payment", back_populates="user", cascade="all, delete-orphan"
    )
    refresh_tokens = relationship(
        "RefreshToken", back_populates="user", cascade="all, delete-orphan"
    )

    # For instructors
    taught_classes = relationship("ClassInstance", back_populates="instructor")

    # Social features
    sent_friend_requests = relationship(
        "Friendship", 
        foreign_keys="Friendship.user_id", 
        back_populates="requester",
        cascade="all, delete-orphan"
    )
    received_friend_requests = relationship(
        "Friendship", 
        foreign_keys="Friendship.friend_id", 
        back_populates="friend",
        cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
        
    def get_usable_packages(self):
        """Get packages that can be used for booking, sorted by priority."""
        from .package import PaymentStatus, ApprovalStatus
        
        usable_packages = [
            pkg for pkg in self.user_packages 
            if pkg.is_valid  # Uses existing is_valid logic
        ]
        
        # Sort by priority: expiry date first, then payment status, then purchase date
        def package_priority(pkg):
            # Priority 1: Days until expiry (lower = higher priority)
            days_to_expiry = pkg.days_until_expiry
            
            # Priority 2: Payment status (authorized before payment_confirmed to use them first)
            status_priority = 0 if pkg.payment_status == PaymentStatus.AUTHORIZED else 1
            
            # Priority 3: Purchase date (older first - FIFO)
            purchase_date = pkg.purchase_date
            
            return (days_to_expiry, status_priority, purchase_date)
        
        return sorted(usable_packages, key=package_priority)
    
    def get_primary_package(self):
        """Get the primary package that should be used next."""
        usable = self.get_usable_packages()
        return usable[0] if usable else None
    
    def get_total_credits(self) -> int:
        """Get total available credits across all usable packages."""
        total = 0
        for pkg in self.get_usable_packages():
            if pkg.package.is_unlimited:
                return float('inf')  # Unlimited credits
            total += pkg.credits_remaining
        return total
    
    def use_credit_smartly(self) -> tuple[bool, str, int]:
        """Use one credit with priority logic. Returns (success, message, package_id_used)."""
        usable_packages = self.get_usable_packages()
        
        if not usable_packages:
            return False, "No usable packages available", 0
        
        # Use credit from highest priority package
        primary_package = usable_packages[0]
        success = primary_package.use_credit()
        
        if success:
            return True, f"Credit used from {primary_package.package.name}", primary_package.id
        else:
            return False, f"Could not use credit from {primary_package.package.name}", primary_package.id

    def __repr__(self):
        return f"<User(id={self.id}, email='{self.email}', role='{self.role}')>"
