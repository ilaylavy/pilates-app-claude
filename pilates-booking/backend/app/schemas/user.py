from datetime import datetime
from typing import Optional

from pydantic import BaseModel, EmailStr, field_validator

from ..models.user import UserRole


class UserBase(BaseModel):
    email: EmailStr
    first_name: str
    last_name: str
    phone: Optional[str] = None
    role: UserRole = UserRole.STUDENT


class UserCreate(UserBase):
    password: str

    @field_validator("password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserUpdate(BaseModel):
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    phone: Optional[str] = None


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(UserBase):
    id: int
    is_active: bool
    is_verified: bool
    avatar_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    email: Optional[str] = None


class PasswordReset(BaseModel):
    email: EmailStr


class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    def validate_password(cls, v):
        if len(v) < 8:
            raise ValueError("Password must be at least 8 characters long")
        if not any(c.isupper() for c in v):
            raise ValueError("Password must contain at least one uppercase letter")
        if not any(c.islower() for c in v):
            raise ValueError("Password must contain at least one lowercase letter")
        if not any(c.isdigit() for c in v):
            raise ValueError("Password must contain at least one digit")
        return v


class UserStats(BaseModel):
    total_bookings: int
    bookings_this_month: int
    attendance_rate: float
    member_since: datetime


class TokenRefresh(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserPreferences(BaseModel):
    email_notifications: bool = True
    sms_notifications: bool = False
    booking_reminders: bool = True
    class_updates: bool = True
    marketing_emails: bool = False


class ExtendedUserStats(BaseModel):
    total_bookings: int
    bookings_this_month: int
    monthly_goal: int = 12  # Default monthly goal
    attendance_rate: float
    member_since: datetime
    week_streak: int
    last_class_date: Optional[datetime] = None
    days_since_last_class: int


class Announcement(BaseModel):
    id: int
    title: str
    message: str
    type: str  # 'info', 'warning', 'success', 'urgent'
    created_at: datetime
    expires_at: Optional[datetime] = None
    is_dismissible: bool = True
    target_roles: Optional[list[str]] = None

    model_config = {"from_attributes": True}


class CreateAnnouncementRequest(BaseModel):
    title: str
    message: str
    type: str = 'info'
    expires_at: Optional[datetime] = None
    target_roles: Optional[list[str]] = None
    is_dismissible: bool = True


class TodayScheduleItem(BaseModel):
    id: int
    class_name: str
    start_time: str
    end_time: str
    current_bookings: int
    capacity: int
    waitlist_count: int
    status: str


class WaitlistNotification(BaseModel):
    class_id: int
    class_name: str
    start_time: str
    waitlist_count: int


class DashboardMetrics(BaseModel):
    weekly_capacity_utilization: float
    active_users_count: int
    active_users_growth: int
    today_classes: list[TodayScheduleItem]
    waitlist_notifications: list[WaitlistNotification]
