from datetime import datetime, timedelta, timezone
from typing import List

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....models.package import Package, UserPackage, UserPackageStatus, PaymentStatus, PaymentMethod as ModelPaymentMethod
from ....models.user import User
from ....schemas.package import (PackageCreate, PackagePurchase,
                                 PackageResponse, PackageUpdate,
                                 UserPackageResponse, PaymentMethod)
from ..deps import get_admin_user, get_current_active_user, get_db

router = APIRouter()


@router.get("/", response_model=List[PackageResponse])
async def get_available_packages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get all available packages."""
    stmt = select(Package).where(Package.is_active == True).order_by(Package.price)
    result = await db.execute(stmt)
    packages = result.scalars().all()

    return packages


@router.post("/purchase", status_code=status.HTTP_200_OK)
async def purchase_package(
    purchase_data: PackagePurchase,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Initiate package purchase - handles both credit card and cash payments."""

    # Get package
    stmt = select(Package).where(
        and_(Package.id == purchase_data.package_id, Package.is_active == True)
    )
    result = await db.execute(stmt)
    package = result.scalar_one_or_none()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    # Handle cash payment differently
    if purchase_data.payment_method == PaymentMethod.CASH:
        return await handle_cash_purchase(package, purchase_data, current_user, db)
    else:
        # Credit card or other electronic payments
        return {
            "message": "Please use the /api/v1/payments/create-payment-intent endpoint to complete the purchase",
            "package_id": package.id,
            "package_name": package.name,
            "price": float(package.price),
            "currency": "ILS",
            "payment_method": purchase_data.payment_method.value,
        }


async def handle_cash_purchase(
    package: Package,
    purchase_data: PackagePurchase,
    current_user: User,
    db: AsyncSession,
):
    """Handle cash package purchase - credits are immediately available, payment confirmation comes later."""
    
    # Create UserPackage as ACTIVE - user can use credits immediately
    # Admin will confirm payment later
    expiry_date = datetime.now(timezone.utc) + timedelta(days=package.validity_days)
    
    user_package = UserPackage(
        user_id=current_user.id,
        package_id=package.id,
        credits_remaining=package.credits,
        expiry_date=expiry_date,
        status=UserPackageStatus.ACTIVE,  # Active immediately
        is_active=True,
        payment_status=PaymentStatus.PENDING,  # Admin needs to confirm payment
        payment_method=ModelPaymentMethod.CASH,
        payment_reference=purchase_data.payment_reference,
    )
    
    db.add(user_package)
    await db.commit()
    await db.refresh(user_package)
    
    # Generate a unique reference code for the cash payment
    reference_code = f"CASH-{user_package.id}-{current_user.id}"
    
    return {
        "message": "Package created successfully! Credits are immediately available for booking. Please pay cash at reception.",
        "status": "active",
        "package_id": package.id,
        "package_name": package.name,
        "user_package_id": user_package.id,
        "price": float(package.price),
        "currency": "ILS",
        "payment_method": "cash",
        "reference_code": reference_code,
        "credits_available": package.credits,
        "payment_instructions": [
            "Your credits are ready to use for booking classes!",
            "Please pay cash at the reception desk when convenient",
            "Show this reference code to the staff: " + reference_code,
            "Payment confirmation will be updated in your account after payment"
        ],
        "expires_at": expiry_date.isoformat()
    }


@router.get("/my-packages")
async def get_user_packages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get current user's packages separated by active, pending, and historical."""
    stmt = (
        select(UserPackage)
        .options(selectinload(UserPackage.package))
        .where(UserPackage.user_id == current_user.id)
        .order_by(UserPackage.created_at.desc())
    )
    result = await db.execute(stmt)
    user_packages = result.scalars().all()

    # Calculate metrics using the loaded packages instead of triggering lazy loading
    usable_packages = [pkg for pkg in user_packages if pkg.is_valid]
    primary_package = next((pkg for pkg in usable_packages if pkg.days_until_expiry is not None), None)
    total_credits = sum(pkg.credits_remaining for pkg in usable_packages)
    
    # Pre-load all properties while session is active to avoid detached instance issues
    active_packages = []
    pending_packages = []
    historical_packages = []
    
    for pkg in user_packages:
        # Access all properties while the session is still active
        pkg_data = {
            'id': pkg.id,
            'user_id': pkg.user_id,
            'package_id': pkg.package_id,
            'package': pkg.package,
            'credits_remaining': pkg.credits_remaining,
            'purchase_date': pkg.purchase_date,
            'expiry_date': pkg.expiry_date,
            'is_active': pkg.is_active,
            'is_expired': pkg.is_expired,
            'is_valid': pkg.is_valid,
            'days_until_expiry': pkg.days_until_expiry,
            'status': pkg.status,
            'payment_status': pkg.payment_status,
            'payment_method': pkg.payment_method,
            'approved_by': pkg.approved_by,
            'approved_at': pkg.approved_at,
            'rejection_reason': pkg.rejection_reason,
            'payment_reference': pkg.payment_reference,
            'admin_notes': pkg.admin_notes,
            'is_pending_approval': pkg.is_pending_approval,
            'is_approved': pkg.is_approved,
            'is_rejected': pkg.is_rejected,
            'is_payment_pending': pkg.is_payment_pending,
            'is_historical': pkg.is_historical,
            # Priority indicators
            'is_primary': pkg.id == (primary_package.id if primary_package else None),
            'usage_priority': next((i for i, p in enumerate(usable_packages) if p.id == pkg.id), None),
            'created_at': pkg.created_at,
            'updated_at': pkg.updated_at,
        }
        
        # Categorize packages
        if pkg.is_historical:
            historical_packages.append(pkg_data)
        elif pkg.is_pending_approval:
            pending_packages.append(pkg_data)
        else:
            active_packages.append(pkg_data)

    return {
        "active_packages": active_packages,
        "pending_packages": pending_packages,
        "historical_packages": historical_packages,
        "total_active": len(active_packages),
        "total_pending": len(pending_packages), 
        "total_historical": len(historical_packages),
        "total_credits": total_credits if total_credits != float('inf') else -1,
        "has_unlimited": total_credits == float('inf'),
        "primary_package_id": primary_package.id if primary_package else None
    }


# Admin endpoints
@router.post("/", response_model=PackageResponse, status_code=status.HTTP_201_CREATED)
async def create_package(
    package_create: PackageCreate,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
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
    admin_user: User = Depends(get_admin_user),
):
    """Update a package (admin only)."""
    stmt = select(Package).where(Package.id == package_id)
    result = await db.execute(stmt)
    package = result.scalar_one_or_none()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    update_data = package_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(package, field, value)

    await db.commit()
    await db.refresh(package)

    return package


@router.get("/catalog", response_model=List[PackageResponse])
async def get_package_catalog(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get package catalog with all available packages."""
    stmt = (
        select(Package)
        .where(Package.is_active == True)
        .order_by(Package.order_index, Package.price)
    )
    result = await db.execute(stmt)
    packages = result.scalars().all()

    return packages


@router.delete("/{package_id}")
async def delete_package(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Delete a package (admin only)."""
    stmt = select(Package).where(Package.id == package_id)
    result = await db.execute(stmt)
    package = result.scalar_one_or_none()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    await db.delete(package)
    await db.commit()

    return {"message": "Package deleted successfully"}


@router.patch("/{package_id}/toggle")
async def toggle_package_status(
    package_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Toggle package active status (admin only)."""
    stmt = select(Package).where(Package.id == package_id)
    result = await db.execute(stmt)
    package = result.scalar_one_or_none()

    if not package:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
        )

    package.is_active = not package.is_active
    await db.commit()

    return {
        "message": f"Package {'activated' if package.is_active else 'deactivated'} successfully"
    }


@router.patch("/reorder")
async def reorder_packages(
    package_order: List[int],
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Reorder packages (admin only)."""
    for index, package_id in enumerate(package_order):
        stmt = select(Package).where(Package.id == package_id)
        result = await db.execute(stmt)
        package = result.scalar_one_or_none()
        if package:
            package.order_index = index

    await db.commit()
    return {"message": "Package order updated successfully"}
