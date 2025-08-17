from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Enum, Numeric, Text
from sqlalchemy.sql import func
from sqlalchemy.orm import relationship
import enum
from ..core.database import Base


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"
    CANCELLED = "cancelled"


class PaymentMethod(str, enum.Enum):
    CREDIT_CARD = "credit_card"
    CASH = "cash"
    BANK_TRANSFER = "bank_transfer"
    PAYPAL = "paypal"
    STRIPE = "stripe"


class PaymentType(str, enum.Enum):
    PACKAGE_PURCHASE = "package_purchase"
    SINGLE_CLASS = "single_class"
    LATE_CANCELLATION_FEE = "late_cancellation_fee"
    NO_SHOW_FEE = "no_show_fee"
    REFUND = "refund"


class Payment(Base):
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    package_id = Column(Integer, ForeignKey("packages.id"), nullable=True)
    user_package_id = Column(Integer, ForeignKey("user_packages.id"), nullable=True)
    amount = Column(Numeric(10, 2), nullable=False)
    currency = Column(String(3), default="ILS", nullable=False)
    payment_type = Column(Enum(PaymentType), nullable=False)
    payment_method = Column(Enum(PaymentMethod), nullable=False)
    status = Column(Enum(PaymentStatus), default=PaymentStatus.PENDING)
    
    # External payment provider fields
    external_transaction_id = Column(String, nullable=True)
    external_payment_id = Column(String, nullable=True)
    
    # Payment details
    payment_date = Column(DateTime(timezone=True), nullable=True)
    refund_date = Column(DateTime(timezone=True), nullable=True)
    refund_amount = Column(Numeric(10, 2), nullable=True)
    
    # Additional information
    description = Column(Text, nullable=True)
    extra_data = Column(Text, nullable=True)  # JSON string for additional data
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    user = relationship("User", back_populates="payments")
    package = relationship("Package")
    user_package = relationship("UserPackage")

    @property
    def is_successful(self) -> bool:
        return self.status == PaymentStatus.COMPLETED

    @property
    def is_refundable(self) -> bool:
        return self.status == PaymentStatus.COMPLETED and self.refund_date is None

    def __repr__(self):
        return f"<Payment(id={self.id}, user_id={self.user_id}, amount={self.amount}, status='{self.status}')>"