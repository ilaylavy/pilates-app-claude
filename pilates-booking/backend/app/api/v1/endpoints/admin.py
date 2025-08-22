from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ....api.v1.deps import get_admin_user, get_db
from ....models.package import Package, UserPackage, UserPackageStatus
from ....models.payment import Payment, PaymentMethod, PaymentStatus
from ....models.user import User, UserRole
from ....schemas.admin import (AttendanceReport, DashboardAnalytics,
                               PackageCreate, PackageUpdate, RevenueReport,
                               UserListResponse, UserUpdate)
from ....schemas.package import (PackageResponse, PaymentApprovalRequest,
                                PaymentRejectionRequest, PendingApprovalResponse,
                                PaymentApprovalResponse, ApprovalStatsResponse,
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


# Cash Reservation Management Endpoints

@router.get("/cash-reservations")
async def get_pending_cash_reservations(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get all pending cash reservations for admin approval."""
    try:
        # Get all pending cash reservations with user and package details
        stmt = (
            select(UserPackage)
            .options(
                selectinload(UserPackage.user),
                selectinload(UserPackage.package)
            )
            .where(UserPackage.status == UserPackageStatus.RESERVED)
            .order_by(UserPackage.created_at.desc())
        )
        result = await db.execute(stmt)
        reservations = result.scalars().all()

        # Format response with relevant details
        reservations_data = []
        for reservation in reservations:
            # Get associated payment details
            payment_stmt = select(Payment).where(
                and_(
                    Payment.user_package_id == reservation.id,
                    Payment.payment_method == PaymentMethod.CASH
                )
            )
            payment_result = await db.execute(payment_stmt)
            payment = payment_result.scalar_one_or_none()

            reservations_data.append({
                "id": reservation.id,
                "user": {
                    "id": reservation.user.id,
                    "email": reservation.user.email,
                    "first_name": reservation.user.first_name,
                    "last_name": reservation.user.last_name,
                },
                "package": {
                    "id": reservation.package.id,
                    "name": reservation.package.name,
                    "credits": reservation.package.credits,
                    "price": float(reservation.package.price),
                },
                "credits_remaining": reservation.credits_remaining,
                "created_at": reservation.created_at.isoformat(),
                "expires_at": reservation.reservation_expires_at.isoformat() if reservation.reservation_expires_at else None,
                "is_expired": reservation.is_reservation_expired,
                "payment_id": payment.id if payment else None,
                "payment_amount": float(payment.amount) if payment else None,
            })

        return {
            "reservations": reservations_data,
            "total": len(reservations_data)
        }

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve cash reservations: {str(e)}"
        )


@router.post("/cash-reservations/{reservation_id}/approve")
async def approve_cash_reservation(
    reservation_id: int,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Approve a cash reservation and activate the package."""
    try:
        # Get the reservation
        stmt = (
            select(UserPackage)
            .options(
                selectinload(UserPackage.user),
                selectinload(UserPackage.package)
            )
            .where(
                and_(
                    UserPackage.id == reservation_id,
                    UserPackage.status == UserPackageStatus.RESERVED,
                )
            )
        )
        result = await db.execute(stmt)
        reservation = result.scalar_one_or_none()

        if not reservation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reservation not found or already processed",
            )

        if reservation.is_reservation_expired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reservation has expired and cannot be approved",
            )

        # Activate the package
        if not reservation.activate_from_reservation():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to activate reservation",
            )

        # Update payment status
        payment_stmt = select(Payment).where(
            and_(
                Payment.user_package_id == reservation.id,
                Payment.payment_method == PaymentMethod.CASH,
                Payment.status == PaymentStatus.PENDING,
            )
        )
        payment_result = await db.execute(payment_stmt)
        payment = payment_result.scalar_one_or_none()

        if payment:
            payment.status = PaymentStatus.COMPLETED
            payment.payment_date = datetime.now(timezone.utc)

        await db.commit()

        # Log the admin action
        admin_service = AdminService(db)
        await admin_service.log_action(
            current_user,
            "APPROVE_CASH_RESERVATION",
            "UserPackage",
            reservation_id,
            {
                "user_email": reservation.user.email,
                "package_name": reservation.package.name,
                "credits": reservation.credits_remaining,
                "payment_id": payment.id if payment else None,
            },
            request,
        )

        return {
            "message": "Cash reservation approved successfully",
            "user_package_id": reservation.id,
            "user_email": reservation.user.email,
            "package_name": reservation.package.name,
            "credits_available": reservation.credits_remaining,
            "expires_at": reservation.expiry_date.isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve cash reservation: {str(e)}",
        )


@router.post("/cash-reservations/{reservation_id}/reject")
async def reject_cash_reservation(
    reservation_id: int,
    reason: Optional[str] = None,
    request: Request = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Reject/cancel a cash reservation."""
    try:
        # Get the reservation
        stmt = (
            select(UserPackage)
            .options(
                selectinload(UserPackage.user),
                selectinload(UserPackage.package)
            )
            .where(
                and_(
                    UserPackage.id == reservation_id,
                    UserPackage.status == UserPackageStatus.RESERVED,
                )
            )
        )
        result = await db.execute(stmt)
        reservation = result.scalar_one_or_none()

        if not reservation:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reservation not found or already processed",
            )

        # Cancel the reservation
        if not reservation.cancel_reservation():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to cancel reservation",
            )

        # Update payment status to cancelled
        payment_stmt = select(Payment).where(
            and_(
                Payment.user_package_id == reservation.id,
                Payment.payment_method == PaymentMethod.CASH,
                Payment.status == PaymentStatus.PENDING,
            )
        )
        payment_result = await db.execute(payment_stmt)
        payment = payment_result.scalar_one_or_none()

        if payment:
            payment.status = PaymentStatus.CANCELLED

        await db.commit()

        # Log the admin action
        admin_service = AdminService(db)
        await admin_service.log_action(
            current_user,
            "REJECT_CASH_RESERVATION",
            "UserPackage",
            reservation_id,
            {
                "user_email": reservation.user.email,
                "package_name": reservation.package.name,
                "reason": reason or "No reason provided",
                "payment_id": payment.id if payment else None,
            },
            request,
        )

        return {
            "message": "Cash reservation rejected successfully",
            "user_package_id": reservation.id,
            "user_email": reservation.user.email,
            "package_name": reservation.package.name,
            "reason": reason or "No reason provided",
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject cash reservation: {str(e)}",
        )


# New Payment Approval System Endpoints

@router.get("/packages/pending-approvals", response_model=List[PendingApprovalResponse])
async def get_pending_approvals(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get all packages pending payment approval."""
    try:
        # For now, return packages with RESERVED status as pending approvals
        # This will be updated once the migration is working
        stmt = (
            select(UserPackage)
            .options(
                selectinload(UserPackage.user),
                selectinload(UserPackage.package)
            )
            .where(UserPackage.status == UserPackageStatus.RESERVED)
            .order_by(UserPackage.created_at.desc())
        )
        result = await db.execute(stmt)
        pending_packages = result.scalars().all()

        pending_approvals = []
        for package in pending_packages:
            hours_waiting = (datetime.now(timezone.utc) - package.created_at).total_seconds() / 3600
            
            pending_approvals.append(PendingApprovalResponse(
                id=package.id,
                user_id=package.user_id,
                user_name=f"{package.user.first_name} {package.user.last_name}",
                user_email=package.user.email,
                package_id=package.package_id,
                package_name=package.package.name,
                package_credits=package.package.credits,
                package_price=package.package.price,
                payment_method=SchemaPaymentMethod.CASH,  # Assume cash for now
                payment_reference=None,  # Will be available after migration
                purchase_date=package.created_at,
                hours_waiting=int(hours_waiting)
            ))

        return pending_approvals

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pending approvals: {str(e)}"
        )


@router.post("/packages/{package_id}/approve")
async def approve_package_payment(
    package_id: int,
    approval_data: PaymentApprovalRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Approve a pending package payment."""
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

        # For now, check if it's in RESERVED status (will be updated after migration)
        if user_package.status != UserPackageStatus.RESERVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Package is not pending approval"
            )

        # Approve the package by activating it from reservation
        if not user_package.activate_from_reservation():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to approve package"
            )

        # Set the admin who approved this package
        user_package.approved_by = current_user.id
        
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
    """Reject a pending package payment."""
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

        # For now, check if it's in RESERVED status (will be updated after migration)
        if user_package.status != UserPackageStatus.RESERVED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Package is not pending approval"
            )

        # Reject the package by cancelling the reservation
        if not user_package.cancel_reservation():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to reject package"
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
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to reject package payment: {str(e)}"
        )


@router.get("/packages/approval-stats", response_model=ApprovalStatsResponse)
async def get_approval_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Get payment approval statistics for admin dashboard."""
    try:
        today = datetime.now(timezone.utc).date()
        yesterday = today - timedelta(days=1)

        # Count total pending approvals
        pending_stmt = select(func.count(UserPackage.id)).where(
            UserPackage.status == UserPackageStatus.RESERVED
        )
        pending_result = await db.execute(pending_stmt)
        total_pending = pending_result.scalar() or 0

        # Count pending from today
        pending_today_stmt = select(func.count(UserPackage.id)).where(
            and_(
                UserPackage.status == UserPackageStatus.RESERVED,
                func.date(UserPackage.created_at) == today
            )
        )
        pending_today_result = await db.execute(pending_today_stmt)
        pending_today = pending_today_result.scalar() or 0

        # Count pending over 24 hours
        cutoff_time = datetime.now(timezone.utc) - timedelta(hours=24)
        pending_over_24h_stmt = select(func.count(UserPackage.id)).where(
            and_(
                UserPackage.status == UserPackageStatus.RESERVED,
                UserPackage.created_at < cutoff_time
            )
        )
        pending_over_24h_result = await db.execute(pending_over_24h_stmt)
        pending_over_24h = pending_over_24h_result.scalar() or 0

        # For now, use mock data for approved/rejected counts since we don't have the actual approval tracking yet
        # This will be replaced with real queries once the migration is complete
        
        return ApprovalStatsResponse(
            total_pending=total_pending,
            pending_today=pending_today,
            pending_over_24h=pending_over_24h,
            avg_approval_time_hours=2.5,  # Mock data
            total_approved_today=0,       # Mock data
            total_rejected_today=0        # Mock data
        )

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get approval stats: {str(e)}"
        )


@router.delete("/packages/{package_id}/admin-cancel")
async def admin_cancel_package(
    package_id: int,
    request: Request,
    reason: str = Query(..., description="Reason for cancellation"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_admin_user),
):
    """Cancel a package (admin only functionality)."""
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

        if user_package.status == UserPackageStatus.CANCELLED:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Package is already cancelled"
            )

        # Check if package has been used
        initial_credits = user_package.package.credits
        used_credits = initial_credits - user_package.credits_remaining
        
        # Cancel the package
        user_package.status = UserPackageStatus.CANCELLED
        user_package.is_active = False

        await db.commit()

        # Log the admin action
        admin_service = AdminService(db)
        await admin_service.log_action(
            current_user,
            "ADMIN_CANCEL_PACKAGE",
            "UserPackage",
            package_id,
            {
                "user_email": user_package.user.email,
                "package_name": user_package.package.name,
                "reason": reason,
                "used_credits": used_credits,
                "remaining_credits": user_package.credits_remaining,
            },
            request,
        )

        return {
            "message": "Package cancelled successfully",
            "user_package_id": package_id,
            "user_email": user_package.user.email,
            "package_name": user_package.package.name,
            "reason": reason,
            "used_credits": used_credits,
            "remaining_credits": user_package.credits_remaining,
        }

    except HTTPException:
        raise
    except Exception as e:
        await db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to cancel package: {str(e)}"
        )
