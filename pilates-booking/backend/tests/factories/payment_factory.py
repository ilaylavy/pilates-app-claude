"""
Payment-related test factories.
"""

import factory
from datetime import datetime
from decimal import Decimal
from faker import Faker

from app.models.payment import Payment, PaymentStatus, PaymentMethod, PaymentType
from app.models.transaction import Transaction, TransactionType
from .base import BaseFactory
from .user_factory import UserFactory
from .package_factory import PackageFactory

fake = Faker()


class PaymentFactory(BaseFactory):
    """Factory for creating payments."""
    
    class Meta:
        model = Payment
        
    user = factory.SubFactory(UserFactory)
    package = factory.SubFactory(PackageFactory)
    amount = factory.LazyAttribute(lambda obj: obj.package.price)
    currency = "ILS"
    payment_type = PaymentType.PACKAGE_PURCHASE
    payment_method = PaymentMethod.CREDIT_CARD
    status = PaymentStatus.COMPLETED
    
    # External payment provider fields
    external_transaction_id = factory.Sequence(lambda n: f"txn_test_{n}")
    external_payment_id = factory.Sequence(lambda n: f"pay_test_{n}")
    
    payment_date = factory.LazyFunction(datetime.utcnow)
    description = factory.LazyAttribute(lambda obj: f"Package purchase: {obj.package.name}")
    

class PendingPaymentFactory(PaymentFactory):
    """Factory for pending payments."""
    
    status = PaymentStatus.PENDING
    payment_date = None


class FailedPaymentFactory(PaymentFactory):
    """Factory for failed payments."""
    
    status = PaymentStatus.FAILED
    description = factory.Faker("sentence", nb_words=6)


class RefundedPaymentFactory(PaymentFactory):
    """Factory for refunded payments."""
    
    status = PaymentStatus.REFUNDED
    refund_date = factory.LazyFunction(datetime.utcnow)
    refund_amount = factory.LazyAttribute(lambda obj: obj.amount)
    description = factory.Faker("sentence", nb_words=8)


class CashPaymentFactory(PaymentFactory):
    """Factory for cash payments."""
    
    payment_method = PaymentMethod.CASH
    external_transaction_id = None
    external_payment_id = None


class TransactionFactory(BaseFactory):
    """Factory for creating transactions."""
    
    class Meta:
        model = Transaction
        
    user = factory.SubFactory(UserFactory)
    credit_amount = factory.Faker("random_int", min=1, max=20)
    transaction_type = TransactionType.CREDIT_PURCHASE
    balance_before = factory.Faker("random_int", min=0, max=100)
    balance_after = factory.LazyAttribute(
        lambda obj: obj.balance_before + obj.credit_amount
    )
    description = factory.LazyAttribute(
        lambda obj: f"Credit purchase - {obj.transaction_type.value}"
    )
    reference_id = factory.Sequence(lambda n: f"ref_{n}")
    is_reversed = False
    

class CreditDeductionTransactionFactory(TransactionFactory):
    """Factory for credit deduction transactions."""
    
    transaction_type = TransactionType.CREDIT_DEDUCTION
    credit_amount = -1  # Negative for deductions
    balance_after = factory.LazyAttribute(
        lambda obj: obj.balance_before + obj.credit_amount
    )
    description = "Class booking - credit usage"


class RefundTransactionFactory(TransactionFactory):
    """Factory for refund transactions."""
    
    transaction_type = TransactionType.CREDIT_REFUND
    description = "Booking cancellation refund"