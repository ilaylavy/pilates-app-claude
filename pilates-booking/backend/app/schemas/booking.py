from datetime import datetime
from typing import Optional

from pydantic import BaseModel

from ..models.booking import BookingStatus, CancellationReason
from .class_schedule import ClassInstanceResponse
from .user import UserResponse


class BookingBase(BaseModel):
    class_instance_id: int


class BookingCreate(BookingBase):
    user_package_id: Optional[int] = None


class BookingResponse(BookingBase):
    id: int
    user_id: int
    user_package_id: Optional[int] = None
    status: BookingStatus
    booking_date: datetime
    cancellation_date: Optional[datetime] = None
    cancellation_reason: Optional[CancellationReason] = None
    notes: Optional[str] = None
    can_cancel: bool = False
    created_at: datetime
    updated_at: datetime
    
    # Nested relationships for mobile app
    class_instance: Optional[ClassInstanceResponse] = None
    user: Optional[UserResponse] = None
    
    # Indicates if this booking was newly created or already existed
    is_new_booking: Optional[bool] = None

    model_config = {"from_attributes": True}


class BookingCancelRequest(BaseModel):
    reason: Optional[str] = None


class WaitlistEntryResponse(BaseModel):
    id: int
    user_id: int
    class_instance_id: int
    position: int
    joined_date: datetime
    notified_date: Optional[datetime] = None
    promoted_date: Optional[datetime] = None
    is_active: bool
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
