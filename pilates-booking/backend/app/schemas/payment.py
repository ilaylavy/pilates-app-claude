from pydantic import BaseModel
from typing import Optional, Dict, Any, List
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


# Stripe-specific schemas
class CreatePaymentIntentRequest(BaseModel):
    package_id: int
    currency: Optional[str] = "ils"
    payment_method_id: Optional[str] = None
    save_payment_method: Optional[bool] = False


class PaymentIntentResponse(BaseModel):
    client_secret: str
    payment_intent_id: str
    amount: int
    currency: str
    status: str


class ConfirmPaymentRequest(BaseModel):
    payment_intent_id: str


class PaymentMethodResponse(BaseModel):
    id: str
    card: Dict[str, Any]
    created: int


class RefundRequest(BaseModel):
    payment_id: int
    amount: Optional[Decimal] = None
    reason: Optional[str] = "requested_by_customer"


class RefundResponse(BaseModel):
    id: str
    amount: int
    currency: str
    status: str
    reason: str


class SubscriptionRequest(BaseModel):
    price_id: Optional[str] = None
    payment_method_id: Optional[str] = None


class SubscriptionResponse(BaseModel):
    id: str
    status: str
    current_period_start: int
    current_period_end: int
    cancel_at_period_end: bool
    client_secret: Optional[str] = None


class PaymentHistoryResponse(BaseModel):
    payments: List[PaymentResponse]
    total_count: int
    page: int
    per_page: int


class InvoiceResponse(BaseModel):
    id: str
    number: Optional[str] = None
    amount_paid: int
    currency: str
    status: str
    created: int
    invoice_pdf: Optional[str] = None
    hosted_invoice_url: Optional[str] = None