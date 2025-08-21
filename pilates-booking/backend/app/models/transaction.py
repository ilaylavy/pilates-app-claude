import enum

from sqlalchemy import (Boolean, Column, DateTime, Enum, ForeignKey, Integer,
                        Numeric, String, Text)
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func

from ..core.database import Base


class TransactionType(str, enum.Enum):
    CREDIT_PURCHASE = "credit_purchase"  # Package purchase
    CREDIT_DEDUCTION = "credit_deduction"  # Class booking
    CREDIT_REFUND = "credit_refund"  # Cancellation refund
    CREDIT_EXPIRY = "credit_expiry"  # Package expiration
    CREDIT_ADJUSTMENT = "credit_adjustment"  # Manual adjustment by admin


class Transaction(Base):
    __tablename__ = "transactions"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    user_package_id = Column(Integer, ForeignKey("user_packages.id"), nullable=True)
    booking_id = Column(Integer, ForeignKey("bookings.id"), nullable=True)
    payment_id = Column(Integer, ForeignKey("payments.id"), nullable=True)

    transaction_type = Column(Enum(TransactionType), nullable=False)
    credit_amount = Column(
        Integer, nullable=False
    )  # Positive for additions, negative for deductions
    balance_before = Column(Integer, nullable=False)
    balance_after = Column(Integer, nullable=False)

    description = Column(Text, nullable=True)
    reference_id = Column(
        String, nullable=True
    )  # External reference (booking ID, etc.)
    is_reversed = Column(Boolean, default=False, nullable=False)
    reversed_by_transaction_id = Column(
        Integer, ForeignKey("transactions.id"), nullable=True
    )

    created_at = Column(DateTime(timezone=True), server_default=func.now())
    created_by = Column(
        Integer, ForeignKey("users.id"), nullable=True
    )  # Who created this transaction

    # Relationships
    user = relationship("User", foreign_keys=[user_id])
    user_package = relationship("UserPackage")
    booking = relationship("Booking")
    payment = relationship("Payment")
    created_by_user = relationship("User", foreign_keys=[created_by])
    reversed_by_transaction = relationship(
        "Transaction", foreign_keys=[reversed_by_transaction_id], remote_side=[id]
    )

    @property
    def is_credit_addition(self) -> bool:
        return self.credit_amount > 0

    @property
    def is_credit_deduction(self) -> bool:
        return self.credit_amount < 0

    def __repr__(self):
        return f"<Transaction(id={self.id}, user_id={self.user_id}, type='{self.transaction_type}', amount={self.credit_amount})>"
