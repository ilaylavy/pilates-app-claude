"""Package service with payment integrity enforcement."""

from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from ..models.package import Package, UserPackage, UserPackageStatus, PaymentStatus as LegacyPaymentStatus, PaymentMethod as LegacyPaymentMethod
from ..models.payment import Payment, PaymentStatus, PaymentMethod, PaymentType
from ..models.user import User


class PackageService:
    """Service for managing package purchases with proper payment dependency."""

    @staticmethod
    async def create_user_package(
        db: AsyncSession,
        user_id: int,
        package_id: int,
        payment_method: PaymentMethod,
        payment_status: PaymentStatus = PaymentStatus.PENDING,
        payment_reference: Optional[str] = None,
        external_transaction_id: Optional[str] = None
    ) -> tuple[UserPackage, Payment]:
        """
        Create a UserPackage with proper Payment record dependency.
        
        This is the ONLY way UserPackages should be created to ensure data integrity.
        Every UserPackage MUST have a corresponding Payment record.
        
        Args:
            db: Database session
            user_id: User ID
            package_id: Package ID
            payment_method: Payment method (cash, credit_card, stripe, etc.)
            payment_status: Payment status (pending, completed, etc.)
            payment_reference: Optional payment reference
            external_transaction_id: Optional external transaction ID
            
        Returns:
            Tuple of (UserPackage, Payment)
            
        Raises:
            ValueError: If package not found or invalid parameters
            RuntimeError: If database constraints are violated
        """
        # Validate package exists and is active
        stmt = select(Package).where(Package.id == package_id, Package.is_active == True)
        result = await db.execute(stmt)
        package = result.scalar_one_or_none()
        
        if not package:
            raise ValueError(f"Package {package_id} not found or inactive")
        
        # STEP 1: Create Payment record FIRST (required for data integrity)
        payment = Payment(
            user_id=user_id,
            package_id=package_id,
            amount=package.price,
            currency="ILS",
            payment_type=PaymentType.PACKAGE_PURCHASE,
            payment_method=payment_method,
            status=payment_status,
            payment_date=datetime.now(timezone.utc) if payment_status == PaymentStatus.COMPLETED else None,
            description=f"Package purchase: {package.name}",
            external_transaction_id=external_transaction_id,
        )
        
        db.add(payment)
        await db.commit()
        await db.refresh(payment)
        
        # STEP 2: Create UserPackage with payment reference
        expiry_date = datetime.now(timezone.utc) + timedelta(days=package.validity_days)
        
        # Determine package status based on payment status
        if payment_status == PaymentStatus.COMPLETED:
            package_status = UserPackageStatus.ACTIVE
        elif payment_status == PaymentStatus.PENDING:
            package_status = UserPackageStatus.ACTIVE  # Allow immediate use for cash payments
        else:
            package_status = UserPackageStatus.CANCELLED
        
        # Map payment statuses for legacy compatibility
        legacy_payment_status_map = {
            PaymentStatus.COMPLETED: LegacyPaymentStatus.CONFIRMED,
            PaymentStatus.PENDING: LegacyPaymentStatus.PENDING,
            PaymentStatus.FAILED: LegacyPaymentStatus.REJECTED,
            PaymentStatus.CANCELLED: LegacyPaymentStatus.REJECTED,
            PaymentStatus.REFUNDED: LegacyPaymentStatus.REJECTED,
        }
        
        legacy_payment_method_map = {
            PaymentMethod.CASH: LegacyPaymentMethod.CASH,
            PaymentMethod.CREDIT_CARD: LegacyPaymentMethod.CREDIT_CARD,
            PaymentMethod.STRIPE: LegacyPaymentMethod.STRIPE,
            PaymentMethod.BANK_TRANSFER: LegacyPaymentMethod.BANK_TRANSFER,
            PaymentMethod.PAYPAL: LegacyPaymentMethod.PAYPAL,
        }
        
        try:
            user_package = UserPackage(
                user_id=user_id,
                package_id=package_id,
                payment_id=payment.id,  # REQUIRED foreign key
                credits_remaining=package.credits,
                expiry_date=expiry_date,
                status=package_status,
                is_active=True,
                # Legacy fields for backward compatibility (will be removed in future)
                payment_status=legacy_payment_status_map.get(payment_status, LegacyPaymentStatus.PENDING),
                payment_method=legacy_payment_method_map.get(payment_method, LegacyPaymentMethod.CREDIT_CARD),
                payment_reference=payment_reference,
            )
            
            db.add(user_package)
            await db.commit()
            await db.refresh(user_package)
            
            return user_package, payment
            
        except Exception as e:
            # If UserPackage creation fails, we need to clean up the payment
            await db.rollback()
            raise RuntimeError(f"Failed to create UserPackage: {str(e)}")

    @staticmethod 
    async def validate_payment_completion(db: AsyncSession, payment_id: int) -> bool:
        """
        Validate that a payment is completed before allowing package usage.
        
        Args:
            db: Database session
            payment_id: Payment ID to validate
            
        Returns:
            True if payment is completed, False otherwise
        """
        stmt = select(Payment).where(Payment.id == payment_id)
        result = await db.execute(stmt)
        payment = result.scalar_one_or_none()
        
        return payment is not None and payment.status == PaymentStatus.COMPLETED

    @staticmethod
    async def get_user_packages_with_payments(
        db: AsyncSession,
        user_id: int,
        include_expired: bool = False
    ) -> list[UserPackage]:
        """
        Get user packages with their payment information.
        
        Args:
            db: Database session
            user_id: User ID
            include_expired: Whether to include expired packages
            
        Returns:
            List of UserPackages with payment relationships loaded
        """
        from sqlalchemy.orm import selectinload
        
        stmt = select(UserPackage).options(
            selectinload(UserPackage.payment),
            selectinload(UserPackage.package)
        ).where(UserPackage.user_id == user_id)
        
        if not include_expired:
            stmt = stmt.where(UserPackage.expiry_date > datetime.now(timezone.utc))
            
        result = await db.execute(stmt)
        return result.scalars().all()