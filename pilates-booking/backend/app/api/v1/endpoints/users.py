import os
import uuid
from pathlib import Path
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ....models.booking import Booking, BookingStatus
from ....models.class_schedule import ClassInstance
from ....models.user import User
from ....schemas.user import (UserPreferences, UserResponse, UserStats,
                              UserUpdate)
from ..deps import get_admin_user, get_current_active_user, get_db

router = APIRouter()


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(
    current_user: User = Depends(get_current_active_user),
):
    """Get current user profile."""
    return current_user


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    user_update: UserUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update current user profile."""
    update_data = user_update.dict(exclude_unset=True)

    for field, value in update_data.items():
        setattr(current_user, field, value)

    await db.commit()
    await db.refresh(current_user)

    return current_user


@router.get("/", response_model=List[UserResponse])
async def get_all_users(
    skip: int = 0,
    limit: int = 100,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get all users (admin only)."""
    from sqlalchemy import select

    stmt = select(User).offset(skip).limit(limit)
    result = await db.execute(stmt)
    users = result.scalars().all()

    return users


@router.get("/{user_id}", response_model=UserResponse)
async def get_user_by_id(
    user_id: int,
    admin_user: User = Depends(get_admin_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user by ID (admin only)."""
    from sqlalchemy import select

    stmt = select(User).where(User.id == user_id)
    result = await db.execute(stmt)
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="User not found"
        )

    return user


@router.post("/me/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Upload user avatar."""
    # Validate file type
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only image files are allowed",
        )

    # Validate file size (5MB max)
    file_size = 0
    content = await file.read()
    file_size = len(content)
    if file_size > 5 * 1024 * 1024:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File too large. Maximum size is 5MB",
        )

    # Create upload directory
    upload_dir = Path("uploads/avatars")
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Generate unique filename
    file_extension = Path(file.filename).suffix if file.filename else ".jpg"
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename

    # Save file
    with open(file_path, "wb") as buffer:
        buffer.write(content)

    # Update user avatar path
    current_user.avatar_url = f"/uploads/avatars/{unique_filename}"
    await db.commit()

    return {"avatar_url": current_user.avatar_url}


@router.get("/me/stats", response_model=UserStats)
async def get_user_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user booking statistics."""
    from datetime import datetime, timedelta

    from sqlalchemy import extract, func, select

    # Get total bookings
    total_stmt = select(func.count(Booking.id)).where(
        Booking.user_id == current_user.id, Booking.status == "confirmed"
    )
    total_result = await db.execute(total_stmt)
    total_bookings = total_result.scalar() or 0

    # Get this month's bookings
    current_month = datetime.now().month
    current_year = datetime.now().year

    month_stmt = select(func.count(Booking.id)).where(
        Booking.user_id == current_user.id,
        Booking.status == "confirmed",
        extract("month", Booking.created_at) == current_month,
        extract("year", Booking.created_at) == current_year,
    )
    month_result = await db.execute(month_stmt)
    month_bookings = month_result.scalar() or 0

    # Calculate attendance rate (completed vs total confirmed bookings)
    attended_stmt = select(func.count(Booking.id)).where(
        Booking.user_id == current_user.id, Booking.status == BookingStatus.COMPLETED
    )
    attended_result = await db.execute(attended_stmt)
    attended_bookings = attended_result.scalar() or 0

    attendance_rate = (
        (attended_bookings / total_bookings * 100) if total_bookings > 0 else 0
    )

    # Get member since date
    member_since = current_user.created_at

    return UserStats(
        total_bookings=total_bookings,
        bookings_this_month=month_bookings,
        attendance_rate=round(attendance_rate, 1),
        member_since=member_since,
    )


@router.patch("/me/preferences", response_model=UserPreferences)
async def update_user_preferences(
    preferences: UserPreferences,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Update user notification preferences."""
    # Store preferences as JSON in user model (we'll need to add this field)
    preferences_dict = preferences.dict()
    current_user.preferences = preferences_dict
    await db.commit()

    return preferences


@router.get("/me/booking-history")
async def get_booking_history(
    skip: int = 0,
    limit: int = 50,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    """Get user's booking history."""
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    stmt = (
        select(Booking)
        .where(Booking.user_id == current_user.id)
        .options(selectinload(Booking.class_instance))
        .order_by(Booking.created_at.desc())
        .offset(skip)
        .limit(limit)
    )

    result = await db.execute(stmt)
    bookings = result.scalars().all()

    return [
        {
            "id": booking.id,
            "class_name": booking.class_instance.class_template.name,
            "date": booking.class_instance.start_time,
            "instructor": booking.class_instance.instructor.full_name
            if booking.class_instance.instructor
            else None,
            "status": booking.status,
            "created_at": booking.created_at,
        }
        for booking in bookings
    ]
