from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from ....schemas.booking import BookingCreate, BookingResponse, BookingCancelRequest, WaitlistEntryResponse
from ....services.booking_service import BookingService
from ....models.user import User
from ..deps import get_db, get_current_active_user

router = APIRouter()


@router.post("/create", response_model=BookingResponse, status_code=status.HTTP_201_CREATED)
async def create_booking(
    booking_create: BookingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Create a new booking."""
    booking_service = BookingService(db)
    booking = await booking_service.create_booking(
        user=current_user,
        class_instance_id=booking_create.class_instance_id,
        user_package_id=booking_create.user_package_id
    )
    return booking


@router.delete("/{booking_id}/cancel", response_model=BookingResponse)
async def cancel_booking(
    booking_id: int,
    cancel_request: BookingCancelRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Cancel a booking."""
    booking_service = BookingService(db)
    booking = await booking_service.cancel_booking(
        booking_id=booking_id,
        user=current_user,
        reason=cancel_request.reason
    )
    return booking


@router.get("/", response_model=List[BookingResponse])
async def get_user_bookings(
    include_past: bool = False,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's bookings."""
    booking_service = BookingService(db)
    bookings = await booking_service.get_user_bookings(
        user_id=current_user.id,
        include_past=include_past
    )
    return bookings


@router.get("/my-bookings", response_model=List[BookingResponse])
async def get_my_bookings(
    status: Optional[str] = None,
    upcoming: bool = False,
    limit: Optional[int] = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's bookings with filtering options."""
    booking_service = BookingService(db)
    bookings = await booking_service.get_user_bookings_filtered(
        user_id=current_user.id,
        status=status,
        upcoming=upcoming,
        limit=limit
    )
    return bookings