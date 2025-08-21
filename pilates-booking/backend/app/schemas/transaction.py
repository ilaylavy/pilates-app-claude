from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from ..models.transaction import TransactionType


class TransactionBase(BaseModel):
    transaction_type: TransactionType
    credit_amount: int
    description: Optional[str] = None


class TransactionCreate(TransactionBase):
    user_package_id: Optional[int] = None
    booking_id: Optional[int] = None
    payment_id: Optional[int] = None
    reference_id: Optional[str] = None


class TransactionResponse(TransactionBase):
    id: int
    user_id: int
    user_package_id: Optional[int] = None
    booking_id: Optional[int] = None
    payment_id: Optional[int] = None
    balance_before: int
    balance_after: int
    reference_id: Optional[str] = None
    is_reversed: bool
    reversed_by_transaction_id: Optional[int] = None
    created_at: datetime
    created_by: Optional[int] = None
    is_credit_addition: bool
    is_credit_deduction: bool

    model_config = {"from_attributes": True}


class TransactionSummary(BaseModel):
    total_credits_purchased: int
    total_credits_used: int
    total_credits_refunded: int
    current_balance: int
    recent_transactions: list[TransactionResponse]

    model_config = {"from_attributes": True}
