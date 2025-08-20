from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from decimal import Decimal


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
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}