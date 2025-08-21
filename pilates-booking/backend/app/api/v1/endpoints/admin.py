from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ....api.v1.deps import get_admin_user, get_db
from ....models.package import Package
from ....models.user import User, UserRole
from ....schemas.admin import (AttendanceReport, DashboardAnalytics,
                               PackageCreate, PackageUpdate, RevenueReport,
                               UserListResponse, UserUpdate)
from ....schemas.package import PackageResponse
from ....services.admin_service import AdminService

router = APIRouter()


@router.get("/users", response_model=List[UserListResponse])
async def get_users(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    search: Optional[str] = Query(None),
    role: Optional[UserRole] = Query(None),
    active_only: Optional[bool] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get all users with filtering options for admin management."""
    admin_service = AdminService(db)
    users = await admin_service.get_users(
        skip=skip, limit=limit, search=search, role_filter=role, active_only=active_only
    )

    # Transform users to include additional stats
    user_responses = []
    for user in users:
        # Count bookings and active packages (simplified for now)
        total_bookings = len(user.bookings) if hasattr(user, "bookings") else 0
        active_packages = (
            len(
                [
                    pkg
                    for pkg in user.user_packages
                    if pkg.is_active and not pkg.is_expired
                ]
            )
            if hasattr(user, "user_packages")
            else 0
        )

        user_responses.append(
            UserListResponse(
                id=user.id,
                email=user.email,
                first_name=user.first_name,
                last_name=user.last_name,
                role=user.role,
                is_active=user.is_active,
                is_verified=user.is_verified,
                created_at=user.created_at,
                total_bookings=total_bookings,
                active_packages=active_packages,
            )
        )

    return user_responses


@router.patch("/users/{user_id}", response_model=UserListResponse)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Update user details."""
    admin_service = AdminService(db)

    # Convert Pydantic model to dict, excluding None values
    update_data = user_update.model_dump(exclude_unset=True)

    if not update_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail="No valid fields to update"
        )

    try:
        updated_user = await admin_service.update_user(
            user_id, update_data, current_user, request
        )

        return UserListResponse(
            id=updated_user.id,
            email=updated_user.email,
            first_name=updated_user.first_name,
            last_name=updated_user.last_name,
            role=updated_user.role,
            is_active=updated_user.is_active,
            is_verified=updated_user.is_verified,
            created_at=updated_user.created_at,
            total_bookings=0,  # Could be calculated if needed
            active_packages=0,  # Could be calculated if needed
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.delete("/users/{user_id}")
async def deactivate_user(
    user_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Deactivate a user account (soft delete)."""
    admin_service = AdminService(db)

    try:
        await admin_service.deactivate_user(user_id, current_user, request)
        return {"message": "User deactivated successfully"}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.get("/analytics/dashboard", response_model=DashboardAnalytics)
async def get_dashboard_analytics(
    db: AsyncSession = Depends(get_db), current_user: User = Depends(get_admin_user)
):
    """Get key metrics for admin dashboard."""
    admin_service = AdminService(db)
    analytics = await admin_service.get_dashboard_analytics()
    return DashboardAnalytics(**analytics)


@router.post("/packages", response_model=PackageResponse)
async def create_package(
    package_data: PackageCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Create a new package."""
    admin_service = AdminService(db)

    # Create package
    package = Package(**package_data.model_dump())
    db.add(package)
    await db.commit()
    await db.refresh(package)

    # Log the action
    await admin_service.log_action(
        current_user,
        "CREATE_PACKAGE",
        "Package",
        package.id,
        {"package_name": package.name, "price": package.price},
        request,
    )

    return PackageResponse.model_validate(package)


@router.patch("/packages/{package_id}", response_model=PackageResponse)
async def update_package(
    package_id: int,
    package_update: PackageUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Update a package."""
    admin_service = AdminService(db)

    stmt = select(Package).where(Package.id == package_id)
    result = await db.execute(stmt)
    package = result.scalar_one_or_none()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    update_data = package_update.model_dump(exclude_unset=True)
    old_values = {key: getattr(package, key) for key in update_data.keys()}

    for key, value in update_data.items():
        if hasattr(package, key):
            setattr(package, key, value)

    await db.commit()
    await db.refresh(package)

    # Log the action
    await admin_service.log_action(
        current_user,
        "UPDATE_PACKAGE",
        "Package",
        package_id,
        {"old_values": old_values, "new_values": update_data},
        request,
    )

    return PackageResponse.model_validate(package)


@router.delete("/packages/{package_id}")
async def delete_package(
    package_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Delete a package (soft delete by deactivating)."""
    admin_service = AdminService(db)

    stmt = select(Package).where(Package.id == package_id)
    result = await db.execute(stmt)
    package = result.scalar_one_or_none()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    package.is_active = False
    await db.commit()

    # Log the action
    await admin_service.log_action(
        current_user,
        "DELETE_PACKAGE",
        "Package",
        package_id,
        {"package_name": package.name},
        request,
    )

    return {"message": "Package deleted successfully"}


@router.get("/reports/revenue", response_model=RevenueReport)
async def get_revenue_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get revenue report for specified date range."""
    admin_service = AdminService(db)
    report = await admin_service.get_revenue_report(start_date, end_date)
    return RevenueReport(**report)


@router.get("/reports/attendance", response_model=AttendanceReport)
async def get_attendance_report(
    start_date: Optional[datetime] = Query(None),
    end_date: Optional[datetime] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get attendance report for specified date range."""
    admin_service = AdminService(db)
    report = await admin_service.get_attendance_report(start_date, end_date)
    return AttendanceReport(**report)
