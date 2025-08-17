from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List
from datetime import datetime, timedelta

from ....schemas.package import PackageCreate, PackageUpdate, PackageResponse, UserPackageResponse
from ....models.package import Package, UserPackage
from ....models.user import User
from ..deps import get_db, get_current_active_user, get_admin_user

router = APIRouter()


@router.get("/", response_model=List[PackageResponse])
async def get_available_packages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get all available packages."""
    stmt = select(Package).where(Package.is_active == True).order_by(Package.price)
    result = await db.execute(stmt)
    packages = result.scalars().all()
    
    return packages


@router.post("/purchase", response_model=UserPackageResponse, status_code=status.HTTP_201_CREATED)
async def purchase_package(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Purchase a package for the current user."""
    
    # Get package
    stmt = select(Package).where(
        and_(Package.id == package_id, Package.is_active == True)
    )
    result = await db.execute(stmt)
    package = result.scalar_one_or_none()
    
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )
    
    # Calculate expiry date
    expiry_date = datetime.utcnow() + timedelta(days=package.validity_days)
    
    # Create user package
    user_package = UserPackage(
        user_id=current_user.id,
        package_id=package.id,
        credits_remaining=package.credits,
        expiry_date=expiry_date
    )
    
    db.add(user_package)
    await db.commit()
    await db.refresh(user_package)
    
    # TODO: Create payment record and process payment
    
    return user_package


@router.get("/my-packages", response_model=List[UserPackageResponse])
async def get_user_packages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user)
):
    """Get current user's packages."""
    stmt = (
        select(UserPackage)
        .where(UserPackage.user_id == current_user.id)
        .order_by(UserPackage.created_at.desc())
    )
    result = await db.execute(stmt)
    user_packages = result.scalars().all()
    
    return user_packages


# Admin endpoints
@router.post("/", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
async def create_package(
    package_create: PackageCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Create a new package (admin only)."""
    db_package = Package(**package_create.dict())
    
    db.add(db_package)
    await db.commit()
    await db.refresh(db_package)
    
    return db_package


@router.put("/{package_id}", response_model=PackageResponse)
async def update_package(
    package_id: int,
    package_update: PackageUpdate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user)
):
    """Update a package (admin only)."""
    stmt = select(Package).where(Package.id == package_id)
    result = await db.execute(stmt)
    package = result.scalar_one_or_none()
    
    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Package not found"
        )
    
    update_data = package_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(package, field, value)
    
    await db.commit()
    await db.refresh(package)
    
    return package