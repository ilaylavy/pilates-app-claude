from datetime import datetime
from decimal import Decimal
from typing import Optional
from enum import Enum

from pydantic import BaseModel


class PaymentMethod(str, Enum):
    CASH = "CASH"
    CREDIT_CARD = "CREDIT_CARD"
    BANK_TRANSFER = "BANK_TRANSFER"
    PAYPAL = "PAYPAL"
    STRIPE = "STRIPE"


class PaymentStatus(str, Enum):
    PENDING_APPROVAL = "pending_approval"
    APPROVED = "approved"
    REJECTED = "rejected"


class PaymentApprovalAction(str, Enum):
    APPROVED = "approved"
    REJECTED = "rejected"


class PackageBase(BaseModel):
    name: str
    description: Optional[str] = None
    credits: int
    price: Decimal
    validity_days: int
    is_unlimited: bool = False


class PackageCreate(PackageBase):
    pass


class PackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    credits: Optional[int] = None
    price: Optional[Decimal] = None
    validity_days: Optional[int] = None
    is_unlimited: Optional[bool] = None
    is_active: Optional[bool] = None


class PackagePurchase(BaseModel):
    package_id: int
    payment_method: PaymentMethod = PaymentMethod.CREDIT_CARD
    payment_reference: Optional[str] = None


class PackageResponse(PackageBase):
    id: int
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class UserPackageResponse(BaseModel):
    id: int
    user_id: int
    package_id: int
    package: PackageResponse
    credits_remaining: int
    purchase_date: datetime
    expiry_date: datetime
    is_active: bool
    is_expired: bool
    is_valid: bool
    days_until_expiry: int
    payment_status: PaymentStatus
    payment_method: PaymentMethod
    approved_by: Optional[int] = None
    approved_at: Optional[datetime] = None
    rejection_reason: Optional[str] = None
    payment_reference: Optional[str] = None
    admin_notes: Optional[str] = None
    is_pending_approval: bool
    is_approved: bool
    is_rejected: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class PaymentApprovalRequest(BaseModel):
    payment_reference: Optional[str] = None
    admin_notes: Optional[str] = None


class PaymentRejectionRequest(BaseModel):
    rejection_reason: str
    admin_notes: Optional[str] = None


class PendingApprovalResponse(BaseModel):
    id: int
    user_id: int
    user_name: str
    user_email: str
    package_id: int
    package_name: str
    package_credits: int
    package_price: Decimal
    payment_method: PaymentMethod
    payment_reference: Optional[str] = None
    purchase_date: datetime
    hours_waiting: int
    
    model_config = {"from_attributes": True}


class PaymentApprovalResponse(BaseModel):
    id: int
    user_package_id: int
    requested_at: datetime
    admin_id: int
    admin_name: str
    action: PaymentApprovalAction
    action_at: datetime
    notes: Optional[str] = None
    created_at: datetime

    model_config = {"from_attributes": True}


class ApprovalStatsResponse(BaseModel):
    total_pending: int
    pending_today: int
    pending_over_24h: int
    avg_approval_time_hours: float
    total_approved_today: int
    total_rejected_today: int
