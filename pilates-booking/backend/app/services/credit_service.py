from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, desc, update
from sqlalchemy.orm import selectinload
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta

from ..models.user import User
from ..models.package import UserPackage
from ..models.booking import Booking, BookingStatus
from ..models.transaction import Transaction, TransactionType
from ..models.payment import Payment, PaymentStatus
from ..schemas.transaction import TransactionCreate, TransactionSummary


class CreditService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_user_credit_balance(self, user_id: int) -> int:
        """Get the total credit balance for a user across all valid packages."""
        stmt = (
            select(func.sum(UserPackage.credits_remaining))
            .where(
                and_(
                    UserPackage.user_id == user_id,
                    UserPackage.is_active == True,
                    UserPackage.expiry_date > datetime.utcnow()
                )
            )
        )
        result = await self.db.execute(stmt)
        balance = result.scalar()
        return balance or 0

    async def get_valid_user_packages(self, user_id: int) -> List[UserPackage]:
        """Get all valid packages for a user, ordered by expiry date (earliest first)."""
        stmt = (
            select(UserPackage)
            .options(selectinload(UserPackage.package))
            .where(
                and_(
                    UserPackage.user_id == user_id,
                    UserPackage.is_active == True,
                    UserPackage.expiry_date > datetime.utcnow(),
                    or_(
                        UserPackage.credits_remaining > 0,
                        UserPackage.package.has(is_unlimited=True)
                    )
                )
            )
            .order_by(UserPackage.expiry_date.asc())  # Use expiring packages first
        )
        result = await self.db.execute(stmt)
        return result.scalars().all()

    async def use_credits_for_booking(
        self, 
        user_id: int, 
        booking_id: int, 
        credits_needed: int = 1
    ) -> Dict[str, Any]:
        """
        Deduct credits from user's packages for a booking.
        Returns information about the deduction.
        """
        user_packages = await self.get_valid_user_packages(user_id)
        
        if not user_packages:
            return {
                "success": False,
                "error": "No valid packages found",
                "credits_used": 0,
                "user_package_id": None
            }

        total_available = sum(
            float('inf') if pkg.package.is_unlimited 
            else pkg.credits_remaining 
            for pkg in user_packages
        )
        
        if total_available < credits_needed and not any(pkg.package.is_unlimited for pkg in user_packages):
            return {
                "success": False,
                "error": f"Insufficient credits. Need {credits_needed}, have {int(total_available)}",
                "credits_used": 0,
                "user_package_id": None
            }

        # Find the best package to use (earliest expiring with credits)
        selected_package = None
        for pkg in user_packages:
            if pkg.package.is_unlimited or pkg.credits_remaining >= credits_needed:
                selected_package = pkg
                break

        if not selected_package:
            return {
                "success": False,
                "error": "No suitable package found",
                "credits_used": 0,
                "user_package_id": None
            }

        # Deduct credits from the selected package
        balance_before = selected_package.credits_remaining
        if not selected_package.package.is_unlimited:
            selected_package.credits_remaining -= credits_needed

        # Create transaction record
        transaction = Transaction(
            user_id=user_id,
            user_package_id=selected_package.id,
            booking_id=booking_id,
            transaction_type=TransactionType.CREDIT_DEDUCTION,
            credit_amount=-credits_needed,
            balance_before=balance_before,
            balance_after=selected_package.credits_remaining,
            description=f"Credit deduction for booking #{booking_id}"
        )
        
        self.db.add(transaction)
        await self.db.commit()
        await self.db.refresh(selected_package)

        return {
            "success": True,
            "credits_used": credits_needed,
            "user_package_id": selected_package.id,
            "transaction_id": transaction.id
        }

    async def refund_credits_for_booking(
        self, 
        user_id: int, 
        booking_id: int,
        user_package_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """
        Refund credits for a cancelled booking.
        """
        # Find the original deduction transaction
        stmt = (
            select(Transaction)
            .where(
                and_(
                    Transaction.user_id == user_id,
                    Transaction.booking_id == booking_id,
                    Transaction.transaction_type == TransactionType.CREDIT_DEDUCTION,
                    Transaction.is_reversed == False
                )
            )
            .order_by(desc(Transaction.created_at))
        )
        result = await self.db.execute(stmt)
        original_transaction = result.scalar_one_or_none()

        if not original_transaction:
            return {
                "success": False,
                "error": "No deduction transaction found for this booking",
                "credits_refunded": 0
            }

        # Get the user package
        user_package = await self.db.get(UserPackage, original_transaction.user_package_id)
        if not user_package:
            return {
                "success": False,
                "error": "User package not found",
                "credits_refunded": 0
            }

        # Check if package is still within refund policy
        # For now, we'll refund as long as the package hasn't expired
        if user_package.is_expired:
            return {
                "success": False,
                "error": "Cannot refund credits to expired package",
                "credits_refunded": 0
            }

        # Refund the credits
        credits_to_refund = abs(original_transaction.credit_amount)
        balance_before = user_package.credits_remaining
        
        if not user_package.package.is_unlimited:
            user_package.credits_remaining += credits_to_refund

        # Create refund transaction
        refund_transaction = Transaction(
            user_id=user_id,
            user_package_id=user_package.id,
            booking_id=booking_id,
            transaction_type=TransactionType.CREDIT_REFUND,
            credit_amount=credits_to_refund,
            balance_before=balance_before,
            balance_after=user_package.credits_remaining,
            description=f"Credit refund for cancelled booking #{booking_id}"
        )

        # Mark original transaction as reversed
        original_transaction.is_reversed = True
        original_transaction.reversed_by_transaction_id = refund_transaction.id

        self.db.add(refund_transaction)
        await self.db.commit()

        return {
            "success": True,
            "credits_refunded": credits_to_refund,
            "user_package_id": user_package.id,
            "transaction_id": refund_transaction.id
        }

    async def expire_packages(self) -> Dict[str, Any]:
        """
        Expire packages that have passed their expiry date.
        This should be run as a background task/cron job.
        """
        # Find packages that should be expired
        stmt = (
            select(UserPackage)
            .where(
                and_(
                    UserPackage.is_active == True,
                    UserPackage.expiry_date <= datetime.utcnow()
                )
            )
        )
        result = await self.db.execute(stmt)
        expired_packages = result.scalars().all()

        expired_count = 0
        transactions_created = 0

        for package in expired_packages:
            if package.credits_remaining > 0 and not package.package.is_unlimited:
                # Create expiry transaction for remaining credits
                transaction = Transaction(
                    user_id=package.user_id,
                    user_package_id=package.id,
                    transaction_type=TransactionType.CREDIT_EXPIRY,
                    credit_amount=-package.credits_remaining,
                    balance_before=package.credits_remaining,
                    balance_after=0,
                    description=f"Credits expired from package {package.package.name}"
                )
                self.db.add(transaction)
                transactions_created += 1

            # Deactivate the package
            package.is_active = False
            package.credits_remaining = 0
            expired_count += 1

        await self.db.commit()

        return {
            "expired_packages": expired_count,
            "transactions_created": transactions_created
        }

    async def get_user_transaction_summary(self, user_id: int, limit: int = 10) -> TransactionSummary:
        """Get transaction summary for a user."""
        # Get recent transactions
        stmt = (
            select(Transaction)
            .where(Transaction.user_id == user_id)
            .order_by(desc(Transaction.created_at))
            .limit(limit)
        )
        result = await self.db.execute(stmt)
        recent_transactions = result.scalars().all()

        # Calculate totals
        totals_stmt = (
            select(
                func.coalesce(func.sum(
                    func.case(
                        (Transaction.transaction_type == TransactionType.CREDIT_PURCHASE, Transaction.credit_amount),
                        else_=0
                    )
                ), 0).label("purchased"),
                func.coalesce(func.sum(
                    func.case(
                        (Transaction.transaction_type == TransactionType.CREDIT_DEDUCTION, func.abs(Transaction.credit_amount)),
                        else_=0
                    )
                ), 0).label("used"),
                func.coalesce(func.sum(
                    func.case(
                        (Transaction.transaction_type == TransactionType.CREDIT_REFUND, Transaction.credit_amount),
                        else_=0
                    )
                ), 0).label("refunded")
            )
            .where(Transaction.user_id == user_id)
        )
        totals_result = await self.db.execute(totals_stmt)
        totals = totals_result.first()

        current_balance = await self.get_user_credit_balance(user_id)

        return TransactionSummary(
            total_credits_purchased=totals.purchased or 0,
            total_credits_used=totals.used or 0,
            total_credits_refunded=totals.refunded or 0,
            current_balance=current_balance,
            recent_transactions=recent_transactions
        )

    async def create_purchase_transaction(
        self, 
        user_id: int, 
        user_package_id: int, 
        payment_id: int,
        credits_purchased: int
    ) -> Transaction:
        """Create a transaction record for package purchase."""
        current_balance = await self.get_user_credit_balance(user_id)
        
        transaction = Transaction(
            user_id=user_id,
            user_package_id=user_package_id,
            payment_id=payment_id,
            transaction_type=TransactionType.CREDIT_PURCHASE,
            credit_amount=credits_purchased,
            balance_before=current_balance - credits_purchased,
            balance_after=current_balance,
            description=f"Credits purchased via package purchase"
        )
        
        self.db.add(transaction)
        await self.db.commit()
        await self.db.refresh(transaction)
        
        return transaction