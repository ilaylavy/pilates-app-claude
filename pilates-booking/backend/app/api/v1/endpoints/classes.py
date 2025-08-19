from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func
from sqlalchemy.orm import selectinload
from typing import List, Optional
from datetime import datetime, timedelta, date
import calendar

from ....schemas.class_schedule import (
    ClassTemplateCreate, ClassTemplateUpdate, ClassTemplateResponse,
    ClassInstanceCreate, ClassInstanceUpdate, ClassInstanceResponse,
    ClassInstanceWithParticipants, ParticipantResponse
)
from ....models.class_schedule import ClassTemplate, ClassInstance, ClassStatus
from ....models.user import User, UserRole
from ....models.booking import Booking
from ..deps import get_db, get_current_active_user, get_admin_user, get_instructor_user

router = APIRouter()


@router.get("/upcoming", response_model=List[ClassInstanceResponse])
async def get_upcoming_classes(
    days_ahead: int = Query(default=7, le=7, description="Number of days to look ahead (max 7)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get upcoming class instances within the next N days."""
    start_date = datetime.utcnow()
    end_date = start_date + timedelta(days=days_ahead)
    
    stmt = (
        select(ClassInstance)
        .where(
            and_(
                ClassInstance.start_datetime >= start_date,
                ClassInstance.start_datetime <= end_date,
                ClassInstance.status == "scheduled"
            )
        )
        .order_by(ClassInstance.start_datetime)
    )
    
    result = await db.execute(stmt)
    class_instances = result.scalars().all()
    
    return class_instances


@router.get("/{class_id}", response_model=ClassInstanceResponse)
async def get_class_instance(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get specific class instance by ID."""
    stmt = select(ClassInstance).where(ClassInstance.id == class_id)
    result = await db.execute(stmt)
    class_instance = result.scalar_one_or_none()
    
    if not class_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    return class_instance


# Template management endpoints (admin/instructor only)
@router.post("/templates", response_model=ClassTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_class_template(
    template_create: ClassTemplateCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Create a new class template (admin only)."""
    db_template = ClassTemplate(**template_create.dict())
    
    db.add(db_template)
    await db.commit()
    await db.refresh(db_template)
    
    return db_template


@router.get("/templates", response_model=List[ClassTemplateResponse])
async def get_class_templates(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    instructor_user: User = Depends(get_instructor_user)
):
    """Get all class templates (instructor/admin only)."""
    stmt = select(ClassTemplate).offset(skip).limit(limit).order_by(ClassTemplate.name)
    result = await db.execute(stmt)
    templates = result.scalars().all()
    
    return templates


@router.post("/instances", response_model=ClassInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_class_instance(
    instance_create: ClassInstanceCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Create a new class instance (admin only)."""
    # Verify template exists
    stmt = select(ClassTemplate).where(ClassTemplate.id == instance_create.template_id)
    result = await db.execute(stmt)
    template = result.scalar_one_or_none()
    
    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class template not found"
        )
    
    # Verify instructor exists
    from ....models.user import User, UserRole
    stmt = select(User).where(
        and_(
            User.id == instance_create.instructor_id,
            User.role.in_([UserRole.INSTRUCTOR, UserRole.ADMIN])
        )
    )
    result = await db.execute(stmt)
    instructor = result.scalar_one_or_none()
    
    if not instructor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instructor not found"
        )
    
    db_instance = ClassInstance(**instance_create.dict())
    
    db.add(db_instance)
    await db.commit()
    await db.refresh(db_instance)
    
    return db_instance


@router.get("/week/{week_date}", response_model=List[ClassInstanceResponse])
async def get_classes_for_week(
    week_date: date,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get classes for a specific week starting from the given date."""
    # Calculate the start and end of the week (assuming week starts on Monday)
    days_since_monday = week_date.weekday()
    week_start = week_date - timedelta(days=days_since_monday)
    week_end = week_start + timedelta(days=6, hours=23, minutes=59, seconds=59)
    
    stmt = (
        select(ClassInstance)
        .options(
            selectinload(ClassInstance.template),
            selectinload(ClassInstance.instructor),
            selectinload(ClassInstance.bookings).selectinload(Booking.user)
        )
        .where(
            and_(
                ClassInstance.start_datetime >= datetime.combine(week_start, datetime.min.time()),
                ClassInstance.start_datetime <= datetime.combine(week_end, datetime.min.time()),
                ClassInstance.status == ClassStatus.SCHEDULED
            )
        )
        .order_by(ClassInstance.start_datetime)
    )
    
    result = await db.execute(stmt)
    class_instances = result.scalars().all()
    
    return class_instances


@router.get("/month/{year}/{month}", response_model=List[ClassInstanceResponse])
async def get_classes_for_month(
    year: int,
    month: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get classes for a specific month (calendar data)."""
    if not (1 <= month <= 12):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Month must be between 1 and 12"
        )
    
    # Get first and last day of the month
    first_day = date(year, month, 1)
    last_day = date(year, month, calendar.monthrange(year, month)[1])
    
    stmt = (
        select(ClassInstance)
        .options(
            selectinload(ClassInstance.template),
            selectinload(ClassInstance.instructor),
            selectinload(ClassInstance.bookings).selectinload(Booking.user)
        )
        .where(
            and_(
                func.date(ClassInstance.start_datetime) >= first_day,
                func.date(ClassInstance.start_datetime) <= last_day,
                ClassInstance.status == ClassStatus.SCHEDULED
            )
        )
        .order_by(ClassInstance.start_datetime)
    )
    
    result = await db.execute(stmt)
    class_instances = result.scalars().all()
    
    return class_instances


@router.get("/{class_id}/participants", response_model=List[ParticipantResponse])
async def get_class_participants(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get list of participants for a specific class."""
    # Verify class exists
    stmt = select(ClassInstance).where(ClassInstance.id == class_id)
    result = await db.execute(stmt)
    class_instance = result.scalar_one_or_none()
    
    if not class_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Get confirmed bookings
    stmt = (
        select(Booking)
        .options(selectinload(Booking.user))
        .where(
            and_(
                Booking.class_instance_id == class_id,
                Booking.status == "confirmed"
            )
        )
        .order_by(Booking.created_at)
    )
    
    result = await db.execute(stmt)
    bookings = result.scalars().all()
    
    # Convert to participant responses
    participants = []
    for booking in bookings:
        participants.append({
            "id": booking.user.id,
            "name": f"{booking.user.first_name} {booking.user.last_name}",
            "email": booking.user.email,
            "booking_date": booking.created_at
        })
    
    return participants


@router.post("/create", response_model=ClassInstanceResponse, status_code=status.HTTP_201_CREATED)
async def create_class(
    instance_create: ClassInstanceCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Create a new class instance (admin only)."""
    return await create_class_instance(instance_create, db, admin_user)


@router.patch("/{class_id}", response_model=ClassInstanceResponse)
async def update_class(
    class_id: int,
    instance_update: ClassInstanceUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Update class instance (admin only)."""
    # Get existing class
    stmt = select(ClassInstance).where(ClassInstance.id == class_id)
    result = await db.execute(stmt)
    class_instance = result.scalar_one_or_none()
    
    if not class_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Update fields
    update_data = instance_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(class_instance, field, value)
    
    await db.commit()
    await db.refresh(class_instance)
    
    return class_instance


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Delete class instance (admin only)."""
    # Get existing class
    stmt = select(ClassInstance).where(ClassInstance.id == class_id)
    result = await db.execute(stmt)
    class_instance = result.scalar_one_or_none()
    
    if not class_instance:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Class not found"
        )
    
    # Check if class has bookings
    stmt = select(func.count(Booking.id)).where(
        and_(
            Booking.class_instance_id == class_id,
            Booking.status == "confirmed"
        )
    )
    result = await db.execute(stmt)
    booking_count = result.scalar()
    
    if booking_count > 0:
        # Instead of deleting, mark as cancelled
        class_instance.status = ClassStatus.CANCELLED
        await db.commit()
    else:
        # Safe to delete if no bookings
        await db.delete(class_instance)
        await db.commit()