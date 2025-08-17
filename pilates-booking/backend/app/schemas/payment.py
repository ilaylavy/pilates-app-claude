from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal
from ..models.payment import PaymentStatus, PaymentMethod, PaymentType


class PaymentBase(BaseModel):
    amount: Decimal
    currency: str = "ILS"
    payment_type: PaymentType
    payment_method: PaymentMethod
    description: Optional[str] = None


class PaymentCreate(PaymentBase):
    package_id: Optional[int] = None
    user_package_id: Optional[int] = None
    external_transaction_id: Optional[str] = None
    extra_data: Optional[str] = None


class PaymentResponse(PaymentBase):
    id: int
    user_id: int
    package_id: Optional[int] = None
    user_package_id: Optional[int] = None
    status: PaymentStatus
    external_transaction_id: Optional[str] = None
    external_payment_id: Optional[str] = None
    payment_date: Optional[datetime] = None
    refund_date: Optional[datetime] = None
    refund_amount: Optional[Decimal] = None
    extra_data: Optional[str] = None
    is_successful: bool
    is_refundable: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}