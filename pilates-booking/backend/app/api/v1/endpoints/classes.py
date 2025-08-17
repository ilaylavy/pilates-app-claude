from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime, timedelta

from ....schemas.class_schedule import (
    ClassTemplateCreate, ClassTemplateUpdate, ClassTemplateResponse,
    ClassInstanceCreate, ClassInstanceUpdate, ClassInstanceResponse
)
from ....models.class_schedule import ClassTemplate, ClassInstance
from ....models.user import User
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