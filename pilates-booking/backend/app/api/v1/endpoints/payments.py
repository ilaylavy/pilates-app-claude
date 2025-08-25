import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import List

import stripe
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import and_, desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from ....core.config import settings
from ....models.package import Package, UserPackage, UserPackageStatus
from ....models.payment import Payment, PaymentMethod, PaymentStatus, PaymentType
from ....models.user import User
from ....schemas.payment import (ConfirmPaymentRequest,
                                 CreatePaymentIntentRequest, InvoiceResponse,
                                 PaymentHistoryResponse, PaymentIntentResponse,
                                 PaymentMethodResponse, PaymentResponse,
                                 RefundRequest, RefundResponse,
                                 SubscriptionRequest, SubscriptionResponse)
from ....services.stripe_service import StripeService
from ..deps import get_admin_user, get_current_active_user, get_db

router = APIRouter()
logger = logging.getLogger(__name__)

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/create-payment-intent", response_model=PaymentIntentResponse)
async def create_payment_intent(
    request: CreatePaymentIntentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a payment intent for package purchase."""
    try:
        # Get package details
        stmt = select(Package).where(
            and_(Package.id == request.package_id, Package.is_active == True)
        )
        result = await db.execute(stmt)
        package = result.scalar_one_or_none()

        if not package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
            )

        # Create or get Stripe customer
        customer_id = await StripeService.create_or_get_customer(current_user, db)

        # Create payment intent
        payment_intent = await StripeService.create_payment_intent(
            amount=package.price,
            currency=request.currency,
            customer_id=customer_id,
            package_id=package.id,
            description=f"Package: {package.name} ({package.credits} credits)",
            metadata={
                "user_id": str(current_user.id),
                "package_id": str(package.id),
                "environment": settings.ENVIRONMENT,
            },
        )

        # Create payment record in database
        await StripeService.create_payment_record(
            db=db,
            user_id=current_user.id,
            amount=package.price,
            currency=request.currency.upper(),
            payment_type=PaymentType.PACKAGE_PURCHASE,
            package_id=package.id,
            stripe_payment_intent_id=payment_intent.id,
            description=f"Package purchase: {package.name}",
            extra_data=json.dumps(
                {
                    "stripe_payment_intent_id": payment_intent.id,
                    "package_credits": package.credits,
                    "validity_days": package.validity_days,
                }
            ),
        )

        return PaymentIntentResponse(
            client_secret=payment_intent.client_secret,
            payment_intent_id=payment_intent.id,
            amount=payment_intent.amount,
            currency=payment_intent.currency,
            status=payment_intent.status,
        )

    except Exception as e:
        logger.error(f"Failed to create payment intent: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create payment intent",
        )


@router.post("/confirm-payment")
async def confirm_payment(
    request: ConfirmPaymentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Confirm a payment and create user package."""
    try:
        # Retrieve payment intent from Stripe
        payment_intent = stripe.PaymentIntent.retrieve(request.payment_intent_id)

        if payment_intent.status != "succeeded":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Payment not successful. Status: {payment_intent.status}",
            )

        # Get payment record from database
        stmt = select(Payment).where(Payment.external_payment_id == payment_intent.id)
        result = await db.execute(stmt)
        payment = result.scalar_one_or_none()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Payment record not found"
            )

        if payment.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Payment does not belong to current user",
            )

        # Update payment status
        await StripeService.update_payment_status(
            db=db,
            payment_id=payment.id,
            status=PaymentStatus.COMPLETED,
            stripe_data={
                "transaction_id": payment_intent.latest_charge,
                "payment_date": datetime.fromtimestamp(
                    payment_intent.created, tz=timezone.utc
                ),
            },
        )

        # Create user package if not already exists
        if payment.package_id and not payment.user_package_id:
            package_stmt = select(Package).where(Package.id == payment.package_id)
            package_result = await db.execute(package_stmt)
            package = package_result.scalar_one()

            from datetime import timedelta

            expiry_date = datetime.now(timezone.utc) + timedelta(
                days=package.validity_days
            )

            user_package = UserPackage(
                user_id=current_user.id,
                package_id=package.id,
                credits_remaining=package.credits,
                expiry_date=expiry_date,
            )

            db.add(user_package)
            await db.commit()
            await db.refresh(user_package)

            # Update payment with user_package_id
            payment.user_package_id = user_package.id
            await db.commit()

        return {"message": "Payment confirmed successfully", "payment_id": payment.id}

    except stripe.error.StripeError as e:
        logger.error(f"Stripe error during payment confirmation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=f"Stripe error: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Failed to confirm payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm payment",
        )


@router.post("/reserve-cash")
async def create_cash_reservation(
    request: CreatePaymentIntentRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create a cash payment reservation for package purchase."""
    try:
        # Get package details
        stmt = select(Package).where(
            and_(Package.id == request.package_id, Package.is_active == True)
        )
        result = await db.execute(stmt)
        package = result.scalar_one_or_none()

        if not package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
            )

        # Check if user already has an active reservation for this package
        existing_stmt = select(UserPackage).where(
            and_(
                UserPackage.user_id == current_user.id,
                UserPackage.package_id == package.id,
                UserPackage.status == UserPackageStatus.RESERVED,
            )
        )
        existing_result = await db.execute(existing_stmt)
        existing_reservation = existing_result.scalar_one_or_none()

        if existing_reservation and not existing_reservation.is_reservation_expired:
            logger.info(
                f"User already has active reservation - returning existing reservation",
                extra={
                    "user_id": str(current_user.id),
                    "package_id": str(package.id),
                    "existing_reservation_id": str(existing_reservation.id),
                }
            )
            
            # Return existing reservation instead of error
            return {
                "message": "You already have an active reservation for this package - waiting for admin approval",
                "reservation_id": existing_reservation.id,
                "expires_at": existing_reservation.reservation_expires_at.isoformat() if existing_reservation.reservation_expires_at else None,
                "is_existing": True,
                "status": "pending_approval"
            }

        # Set reservation expiry (48 hours from now)
        from datetime import timedelta
        reservation_expires_at = datetime.now(timezone.utc) + timedelta(hours=48)

        # Create reserved user package
        user_package = UserPackage(
            user_id=current_user.id,
            package_id=package.id,
            credits_remaining=package.credits,
            expiry_date=datetime.now(timezone.utc) + timedelta(days=package.validity_days),
            status=UserPackageStatus.RESERVED,
            reservation_expires_at=reservation_expires_at,
        )

        db.add(user_package)
        await db.commit()
        await db.refresh(user_package)

        # Create payment record
        payment = Payment(
            user_id=current_user.id,
            package_id=package.id,
            user_package_id=user_package.id,
            amount=package.price,
            currency="ILS",
            payment_type=PaymentType.PACKAGE_PURCHASE,
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.PENDING,
            description=f"Cash reservation: {package.name}",
            extra_data=json.dumps({
                "reservation_expires_at": reservation_expires_at.isoformat(),
                "package_credits": package.credits,
                "validity_days": package.validity_days,
            }),
        )

        db.add(payment)
        await db.commit()
        await db.refresh(payment)

        return {
            "message": "Package reserved successfully - waiting for admin approval",
            "reservation_id": str(user_package.id),
            "expires_at": reservation_expires_at.isoformat(),
            "payment_id": payment.id,
            "instructions": "Your package is reserved. An admin will approve your purchase and activate your credits soon.",
            "status": "pending_approval"
        }

    except Exception as e:
        logger.error(f"Failed to create cash reservation: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create reservation",
        )


@router.post("/confirm-cash-payment/{reservation_id}")
async def confirm_cash_payment(
    reservation_id: int,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Confirm cash payment and activate package (admin only)."""
    try:
        # Get user package reservation
        stmt = select(UserPackage).where(
            and_(
                UserPackage.id == reservation_id,
                UserPackage.status == UserPackageStatus.RESERVED,
            )
        )
        result = await db.execute(stmt)
        user_package = result.scalar_one_or_none()

        if not user_package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Reservation not found or already processed",
            )

        if user_package.is_reservation_expired:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Reservation has expired",
            )

        # Activate the package
        if not user_package.activate_from_reservation():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to activate reservation",
            )

        # Update payment status
        payment_stmt = select(Payment).where(
            and_(
                Payment.user_package_id == user_package.id,
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

        return {
            "message": "Cash payment confirmed successfully",
            "user_package_id": user_package.id,
            "credits_available": user_package.credits_remaining,
            "expires_at": user_package.expiry_date.isoformat(),
        }

    except Exception as e:
        logger.error(f"Failed to confirm cash payment: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to confirm cash payment",
        )


@router.get("/methods", response_model=List[PaymentMethodResponse])
async def get_payment_methods(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get saved payment methods for current user."""
    try:
        if not current_user.stripe_customer_id:
            return []

        payment_methods = await StripeService.get_customer_payment_methods(
            current_user.stripe_customer_id
        )

        return [
            PaymentMethodResponse(id=pm["id"], card=pm["card"], created=pm["created"])
            for pm in payment_methods
        ]

    except Exception as e:
        logger.error(f"Failed to get payment methods: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment methods",
        )


@router.post("/refund/{payment_id}", response_model=RefundResponse)
async def request_refund(
    payment_id: int,
    request: RefundRequest,
    db: AsyncSession = Depends(get_db),
    admin_user: User = Depends(get_admin_user),
):
    """Process refund for a payment (admin only)."""
    try:
        # Get payment record
        stmt = select(Payment).where(Payment.id == payment_id)
        result = await db.execute(stmt)
        payment = result.scalar_one_or_none()

        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found"
            )

        if not payment.is_refundable:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Payment is not refundable",
            )

        # Process refund with Stripe
        refund_amount = None
        if request.amount:
            refund_amount = int(request.amount * 100)  # Convert to cents

        refund = await StripeService.process_refund(
            payment_intent_id=payment.external_payment_id,
            amount=refund_amount,
            reason=request.reason,
        )

        # Update payment status
        await StripeService.update_payment_status(
            db=db,
            payment_id=payment.id,
            status=PaymentStatus.REFUNDED,
            stripe_data={
                "refund_date": datetime.now(timezone.utc),
                "refund_amount": Decimal(refund.amount) / 100,
            },
        )

        return RefundResponse(
            id=refund.id,
            amount=refund.amount,
            currency=refund.currency,
            status=refund.status,
            reason=refund.reason,
        )

    except Exception as e:
        logger.error(f"Failed to process refund: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process refund",
        )


@router.delete("/methods/{method_id}")
async def remove_payment_method(
    method_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Remove a saved payment method."""
    try:
        if not current_user.stripe_customer_id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No payment methods found"
            )

        # Detach payment method from customer in Stripe
        success = await StripeService.detach_payment_method(method_id)
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to remove payment method"
            )

        return {"message": "Payment method removed successfully"}

    except Exception as e:
        logger.error(f"Failed to remove payment method: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to remove payment method",
        )


@router.get("/history", response_model=PaymentHistoryResponse)
async def get_payment_history(
    page: int = 1,
    per_page: int = 10,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get payment history for current user."""
    try:
        offset = (page - 1) * per_page

        # Get payments with count
        stmt = (
            select(Payment)
            .where(Payment.user_id == current_user.id)
            .order_by(desc(Payment.created_at))
            .offset(offset)
            .limit(per_page)
        )
        result = await db.execute(stmt)
        payments = result.scalars().all()

        # Get total count
        count_stmt = select(Payment).where(Payment.user_id == current_user.id)
        count_result = await db.execute(count_stmt)
        total_count = len(count_result.scalars().all())

        return PaymentHistoryResponse(
            payments=payments, total_count=total_count, page=page, per_page=per_page
        )

    except Exception as e:
        logger.error(f"Failed to get payment history: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve payment history",
        )


@router.get("/invoices/{invoice_id}", response_model=InvoiceResponse)
async def get_invoice(
    invoice_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Get invoice details."""
    try:
        invoice = await StripeService.retrieve_invoice(invoice_id)

        return InvoiceResponse(
            id=invoice.id,
            number=invoice.number,
            amount_paid=invoice.amount_paid,
            currency=invoice.currency,
            status=invoice.status,
            created=invoice.created,
            invoice_pdf=invoice.invoice_pdf,
            hosted_invoice_url=invoice.hosted_invoice_url,
        )

    except Exception as e:
        logger.error(f"Failed to get invoice: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to retrieve invoice",
        )


# Subscription endpoints
@router.post("/subscriptions", response_model=SubscriptionResponse)
async def create_subscription(
    request: SubscriptionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Create monthly unlimited subscription."""
    try:
        # Create or get Stripe customer
        customer_id = await StripeService.create_or_get_customer(current_user, db)

        # Use default price ID if not provided
        price_id = request.price_id or settings.STRIPE_MONTHLY_SUBSCRIPTION_PRICE_ID

        subscription = await StripeService.create_subscription(
            customer_id=customer_id,
            price_id=price_id,
            metadata={
                "user_id": str(current_user.id),
                "environment": settings.ENVIRONMENT,
            },
        )

        return SubscriptionResponse(
            id=subscription.id,
            status=subscription.status,
            current_period_start=subscription.current_period_start,
            current_period_end=subscription.current_period_end,
            cancel_at_period_end=subscription.cancel_at_period_end,
            client_secret=subscription.latest_invoice.payment_intent.client_secret
            if subscription.latest_invoice
            else None,
        )

    except Exception as e:
        logger.error(f"Failed to create subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create subscription",
        )


@router.delete("/subscriptions/{subscription_id}")
async def cancel_subscription(
    subscription_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """Cancel subscription."""
    try:
        subscription = await StripeService.cancel_subscription(subscription_id)

        return {
            "message": "Subscription cancelled successfully",
            "subscription_id": subscription.id,
            "cancel_at_period_end": subscription.cancel_at_period_end,
        }

    except Exception as e:
        logger.error(f"Failed to cancel subscription: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to cancel subscription",
        )
