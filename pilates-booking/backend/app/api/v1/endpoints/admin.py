from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ....api.v1.deps import get_admin_user, get_db
from ....models.package import Package, UserPackage, UserPackageStatus, PaymentStatus
from ....models.payment import Payment, PaymentMethod
from ....models.payment import PaymentStatus as PaymentPaymentStatus
from ....models.user import User, UserRole
from ....schemas.admin import (AttendanceReport, DashboardAnalytics,
                               PackageCreate, PackageUpdate, RevenueReport,
                               UserListResponse, UserUpdate)
from ....schemas.user import (CreateAnnouncementRequest, Announcement,
                              DashboardMetrics)
from ....schemas.package import (PackageResponse, PaymentApprovalRequest,
                                PaymentRejectionRequest,
                                PaymentStatus as SchemaPaymentStatus, 
                                PaymentMethod as SchemaPaymentMethod)
from sqlalchemy.orm import selectinload
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


@router.get("/users/{user_id}/packages")
async def get_user_packages(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get all packages for a specific user (admin only)."""
    try:
        # Get user packages with package details
        stmt = (
            select(UserPackage)
            .options(
                selectinload(UserPackage.package),
                selectinload(UserPackage.user)
            )
            .where(UserPackage.user_id == user_id)
            .order_by(UserPackage.created_at.desc())
        )
        result = await db.execute(stmt)
        user_packages = result.scalars().all()

        packages_data = []
        for user_package in user_packages:
            packages_data.append({
                "id": user_package.id,
                "package_id": user_package.package_id,
                "package_name": user_package.package.name,
                "package_description": user_package.package.description,
                "total_credits": user_package.package.credits,
                "credits_remaining": user_package.credits_remaining,
                "credits_used": user_package.package.credits - user_package.credits_remaining,
                "price": float(user_package.package.price),
                "status": user_package.status.value,
                "is_active": user_package.is_active,
                "is_expired": user_package.is_expired,
                "purchased_at": user_package.created_at.isoformat(),
                "expires_at": user_package.expiry_date.isoformat() if user_package.expiry_date else None,
                "is_unlimited": user_package.package.is_unlimited,
                "validity_days": user_package.package.validity_days,
            })

        return packages_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user packages: {str(e)}"
        )


@router.get("/users/{user_id}/bookings")
async def get_user_bookings(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get all bookings for a specific user (admin only)."""
    try:
        # Import here to avoid circular imports
        from ....models.booking import Booking
        from ....models.class_schedule import ClassInstance, ClassTemplate

        # Get user bookings with class details
        stmt = (
            select(Booking)
            .options(
                selectinload(Booking.class_instance).selectinload(ClassInstance.template),
                selectinload(Booking.class_instance).selectinload(ClassInstance.instructor),
                selectinload(Booking.user)
            )
            .where(Booking.user_id == user_id)
            .order_by(Booking.created_at.desc())
        )
        result = await db.execute(stmt)
        bookings = result.scalars().all()

        bookings_data = []
        for booking in bookings:
            class_instance = booking.class_instance
            class_template = class_instance.template
            instructor = class_instance.instructor

            bookings_data.append({
                "id": booking.id,
                "booking_date": booking.created_at.isoformat(),
                "status": booking.status.value,
                "class_id": class_instance.id,
                "class_name": class_template.name,
                "class_description": class_template.description,
                "class_date": class_instance.start_datetime.isoformat(),
                "class_duration": class_template.duration_minutes,
                "instructor_name": f"{instructor.first_name} {instructor.last_name}" if instructor else "TBA",
                "location": getattr(class_template, 'location', 'TBA'),
                "capacity": class_template.capacity,
                "is_cancelled": booking.status == 'cancelled',
                "cancelled_at": booking.cancellation_date.isoformat() if booking.cancellation_date else None,
                "attended": booking.status == 'completed',
                "no_show": booking.status == 'no_show',
            })

        return bookings_data

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get user bookings: {str(e)}"
        )


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


@router.post("/packages/{package_id}/approve")
async def approve_package_payment(
    package_id: int,
    approval_data: PaymentApprovalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Approve a pending package payment (simplified version)."""
    try:
        # Get the package
        stmt = (
            select(UserPackage)
            .options(
                selectinload(UserPackage.user),
                selectinload(UserPackage.package)
            )
            .where(UserPackage.id == package_id)
        )
        result = await db.execute(stmt)
        user_package = result.scalar_one_or_none()

        if not user_package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package not found"
            )

        # Check if package can be approved
        if user_package.payment_status == PaymentStatus.CONFIRMED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Package payment is already confirmed"
            )

        # Approve the payment using existing method
        success, message = user_package.confirm_payment(
            admin_id=current_user.id,
            payment_reference=approval_data.payment_reference,
            admin_notes=approval_data.admin_notes
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )

        await db.commit()

        # Log the admin action
        admin_service = AdminService(db)
        await admin_service.log_action(
            current_user,
            "APPROVE_PACKAGE_PAYMENT",
            "UserPackage",
            package_id,
            {
                "user_email": user_package.user.email,
                "package_name": user_package.package.name,
                "payment_reference": approval_data.payment_reference,
                "admin_notes": approval_data.admin_notes,
            },
            request,
        )

        return {
            "message": "Package payment approved successfully",
            "user_package_id": package_id,
            "user_email": user_package.user.email,
            "package_name": user_package.package.name,
            "credits_available": user_package.credits_remaining,
            "payment_status": user_package.payment_status.value,
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve package payment: {str(e)}"
        )


@router.post("/packages/{package_id}/reject")
async def reject_package_payment(
    package_id: int,
    rejection_data: PaymentRejectionRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Reject a pending package payment (simplified version)."""
    try:
        # Get the package
        stmt = (
            select(UserPackage)
            .options(
                selectinload(UserPackage.user),
                selectinload(UserPackage.package)
            )
            .where(UserPackage.id == package_id)
        )
        result = await db.execute(stmt)
        user_package = result.scalar_one_or_none()

        if not user_package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package not found"
            )

        # Validate rejection reason
        if not rejection_data.rejection_reason or not rejection_data.rejection_reason.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Rejection reason is required"
            )

        # Check if package can be rejected
        if user_package.payment_status not in [PaymentStatus.PENDING]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Package payment cannot be rejected (status: {user_package.payment_status.value})"
            )

        # Reject the payment using existing method
        success, message = user_package.reject_payment(
            admin_id=current_user.id,
            rejection_reason=rejection_data.rejection_reason.strip(),
            admin_notes=rejection_data.admin_notes
        )

        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=message
            )

        await db.commit()

        # Log the admin action
        admin_service = AdminService(db)
        await admin_service.log_action(
            current_user,
            "REJECT_PACKAGE_PAYMENT",
            "UserPackage",
            package_id,
            {
                "user_email": user_package.user.email,
                "package_name": user_package.package.name,
                "rejection_reason": rejection_data.rejection_reason,
                "admin_notes": rejection_data.admin_notes,
            },
            request,
        )

        return {
            "message": "Package payment rejected successfully",
            "user_package_id": package_id,
            "user_email": user_package.user.email,
            "package_name": user_package.package.name,
            "rejection_reason": rejection_data.rejection_reason,
            "payment_status": user_package.payment_status.value,
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject package payment: {str(e)}"
        )


@router.post("/announcements", response_model=Announcement)
async def create_announcement(
    announcement_data: CreateAnnouncementRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Create a new system announcement."""
    from ....models.announcement import Announcement as AnnouncementModel
    
    try:
        # Create the announcement
        announcement = AnnouncementModel(
            title=announcement_data.title,
            message=announcement_data.message,
            type=announcement_data.type,
            expires_at=announcement_data.expires_at,
            target_roles=announcement_data.target_roles,
            is_dismissible=announcement_data.is_dismissible,
            created_by=current_user.id,
        )
        
        db.add(announcement)
        await db.commit()
        await db.refresh(announcement)
        
        # Log the admin action
        admin_service = AdminService(db)
        await admin_service.log_action(
            current_user,
            "CREATE_ANNOUNCEMENT",
            "Announcement",
            announcement.id,
            {
                "title": announcement.title,
                "type": announcement.type,
                "target_roles": announcement.target_roles,
            },
            request,
        )
        
        return announcement
        
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create announcement: {str(e)}"
        )


@router.get("/dashboard/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get admin dashboard metrics."""
    from datetime import datetime, timedelta
    from sqlalchemy import and_, desc, extract, func
    from ....models.booking import Booking
    from ....models.class_schedule import ClassInstance, ClassTemplate
    from ....models.booking import WaitlistEntry
    
    try:
        # Calculate weekly capacity utilization
        one_week_ago = datetime.now() - timedelta(days=7)
        
        # Get total capacity and bookings for the past week
        capacity_stmt = (
            select(
                func.sum(ClassInstance.actual_capacity).label('total_capacity'),
                func.count(Booking.id).label('total_bookings')
            )
            .select_from(ClassInstance)
            .outerjoin(Booking)
            .where(
                and_(
                    ClassInstance.start_datetime >= one_week_ago,
                    ClassInstance.start_datetime <= datetime.now(),
                    ClassInstance.status == 'scheduled'
                )
            )
        )
        
        capacity_result = await db.execute(capacity_stmt)
        capacity_data = capacity_result.first()
        
        total_capacity = capacity_data.total_capacity or 0
        total_bookings = capacity_data.total_bookings or 0
        
        weekly_utilization = (total_bookings / total_capacity * 100) if total_capacity > 0 else 0
        
        # Get active users count (users with bookings in last 30 days)
        thirty_days_ago = datetime.now() - timedelta(days=30)
        
        active_users_stmt = (
            select(func.count(func.distinct(Booking.user_id)))
            .where(
                and_(
                    Booking.created_at >= thirty_days_ago,
                    Booking.status == 'confirmed'
                )
            )
        )
        
        active_users_result = await db.execute(active_users_stmt)
        active_users_count = active_users_result.scalar() or 0
        
        # Calculate growth (compare to previous 30 days)
        sixty_days_ago = datetime.now() - timedelta(days=60)
        
        prev_active_users_stmt = (
            select(func.count(func.distinct(Booking.user_id)))
            .where(
                and_(
                    Booking.created_at >= sixty_days_ago,
                    Booking.created_at < thirty_days_ago,
                    Booking.status == 'confirmed'
                )
            )
        )
        
        prev_active_users_result = await db.execute(prev_active_users_stmt)
        prev_active_users_count = prev_active_users_result.scalar() or 0
        
        user_growth = active_users_count - prev_active_users_count
        
        # Get today's classes
        today = datetime.now().date()
        today_classes_stmt = (
            select(ClassInstance, ClassTemplate)
            .join(ClassTemplate)
            .where(
                and_(
                    func.date(ClassInstance.start_datetime) == today,
                    ClassInstance.status == 'scheduled'
                )
            )
            .order_by(ClassInstance.start_datetime)
        )
        
        today_classes_result = await db.execute(today_classes_stmt)
        today_classes_data = today_classes_result.all()
        
        today_classes = []
        for class_instance, template in today_classes_data:
            # Count current bookings for this class
            bookings_count_stmt = (
                select(func.count(Booking.id))
                .where(
                    and_(
                        Booking.class_instance_id == class_instance.id,
                        Booking.status == 'confirmed'
                    )
                )
            )
            bookings_count_result = await db.execute(bookings_count_stmt)
            current_bookings = bookings_count_result.scalar() or 0
            
            # Count waitlist
            waitlist_count_stmt = (
                select(func.count(WaitlistEntry.id))
                .where(WaitlistEntry.class_instance_id == class_instance.id)
            )
            waitlist_count_result = await db.execute(waitlist_count_stmt)
            waitlist_count = waitlist_count_result.scalar() or 0
            
            today_classes.append({
                "id": class_instance.id,
                "class_name": template.name,
                "start_time": class_instance.start_datetime.strftime("%H:%M"),
                "end_time": class_instance.end_datetime.strftime("%H:%M"),
                "current_bookings": current_bookings,
                "capacity": class_instance.actual_capacity or template.capacity,
                "waitlist_count": waitlist_count,
                "status": class_instance.status,
            })
        
        # Get waitlist notifications (classes with waitlists)
        waitlist_notifications = []
        for class_data in today_classes:
            if class_data["waitlist_count"] > 0:
                waitlist_notifications.append({
                    "class_id": class_data["id"],
                    "class_name": class_data["class_name"],
                    "start_time": class_data["start_time"],
                    "waitlist_count": class_data["waitlist_count"],
                })
        
        return DashboardMetrics(
            weekly_capacity_utilization=round(weekly_utilization, 1),
            active_users_count=active_users_count,
            active_users_growth=user_growth,
            today_classes=today_classes,
            waitlist_notifications=waitlist_notifications,
        )
        
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get dashboard metrics: {str(e)}"
        )


# ===== DISABLED ENDPOINTS =====
# The following endpoints are temporarily disabled until missing models/methods are implemented:
# - get_pending_cash_reservations (requires reservation methods)
# - approve_cash_reservation (requires reservation methods)  
# - reject_cash_reservation (requires reservation methods)
# - get_pending_approvals (requires ApprovalStatus enum)
# - authorize_package_payment (requires PaymentApproval model)
# - confirm_package_payment (requires PaymentApproval model)
# - revoke_package_authorization (requires PaymentApproval model)
# - get_approval_stats (requires approval tracking)
# - admin_cancel_package (working but simplified)