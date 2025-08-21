from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, EmailStr

from ..models.user import UserRole
from .user import UserResponse


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None
    role: Optional[UserRole] = None
    is_active: Optional[bool] = None
    is_verified: Optional[bool] = None


class UserListResponse(BaseModel):
    id: int
    email: str
    first_name: str
    last_name: str
    role: UserRole
    is_active: bool
    is_verified: bool
    created_at: datetime
    total_bookings: Optional[int] = 0
    active_packages: Optional[int] = 0

    class Config:
        from_attributes = True


class PackageCreate(BaseModel):
    name: str
    description: Optional[str] = None
    price: float
    credits: Optional[int] = None
    is_unlimited: bool = False
    validity_days: int
    is_active: bool = True


class PackageUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    price: Optional[float] = None
    credits: Optional[int] = None
    is_unlimited: Optional[bool] = None
    validity_days: Optional[int] = None
    is_active: Optional[bool] = None


class DashboardAnalytics(BaseModel):
    total_users: int
    new_users_last_30_days: int
    total_bookings: int
    total_revenue: float
    monthly_revenue: float
    popular_packages: List[Dict[str, Any]]


class RevenueReportItem(BaseModel):
    date: str
    revenue: float


class PackageRevenueItem(BaseModel):
    package: str
    revenue: float
    sales_count: int


class RevenueReport(BaseModel):
    period: Dict[str, str]
    total_revenue: float
    revenue_by_date: List[RevenueReportItem]
    revenue_by_package: List[PackageRevenueItem]


class BookingReportItem(BaseModel):
    date: str
    bookings: int


class PopularTimeItem(BaseModel):
    time: str
    bookings: int


class AttendanceReport(BaseModel):
    period: Dict[str, str]
    bookings_by_date: List[BookingReportItem]
    popular_times: List[PopularTimeItem]


class AuditLogRead(BaseModel):
    id: int
    user_id: int
    action: str
    resource_type: str
    resource_id: Optional[int]
    details: Optional[Dict[str, Any]]
    ip_address: Optional[str]
    user_agent: Optional[str]
    timestamp: datetime

    class Config:
        from_attributes = True
