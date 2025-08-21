import json
import logging
from datetime import datetime, timezone

import stripe
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.config import settings
from ....models.payment import Payment, PaymentStatus, PaymentType
from ....models.user import User
from ....services.stripe_service import StripeService
from ..deps import get_db

router = APIRouter()
logger = logging.getLogger(__name__)

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY


@router.post("/stripe")
async def handle_stripe_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    """Handle Stripe webhooks for payment events."""
    try:
        payload = await request.body()
        sig_header = request.headers.get("stripe-signature")

        if not sig_header:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Missing Stripe signature header",
            )

        # Verify webhook signature
        try:
            event = stripe.Webhook.construct_event(
                payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
            )
        except ValueError:
            logger.error("Invalid payload in Stripe webhook")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid payload"
            )
        except stripe.error.SignatureVerificationError:
            logger.error("Invalid signature in Stripe webhook")
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid signature"
            )

        # Handle the event
        await handle_webhook_event(event, db)

        return {"status": "success"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error handling Stripe webhook: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Webhook processing failed",
        )


async def handle_webhook_event(event: dict, db: AsyncSession):
    """Process individual webhook events."""
    event_type = event["type"]
    data = event["data"]["object"]

    logger.info(f"Processing Stripe webhook event: {event_type}")

    if event_type == "payment_intent.succeeded":
        await handle_payment_intent_succeeded(data, db)

    elif event_type == "payment_intent.payment_failed":
        await handle_payment_intent_failed(data, db)

    elif event_type == "invoice.payment_succeeded":
        await handle_invoice_payment_succeeded(data, db)

    elif event_type == "invoice.payment_failed":
        await handle_invoice_payment_failed(data, db)

    elif event_type == "customer.subscription.created":
        await handle_subscription_created(data, db)

    elif event_type == "customer.subscription.updated":
        await handle_subscription_updated(data, db)

    elif event_type == "customer.subscription.deleted":
        await handle_subscription_deleted(data, db)

    elif event_type == "charge.dispute.created":
        await handle_dispute_created(data, db)

    else:
        logger.info(f"Unhandled webhook event type: {event_type}")


async def handle_payment_intent_succeeded(payment_intent: dict, db: AsyncSession):
    """Handle successful payment intent."""
    try:
        payment_intent_id = payment_intent["id"]

        # Find payment record in database
        stmt = select(Payment).where(Payment.external_payment_id == payment_intent_id)
        result = await db.execute(stmt)
        payment = result.scalar_one_or_none()

        if payment and payment.status == PaymentStatus.PENDING:
            # Update payment status
            await StripeService.update_payment_status(
                db=db,
                payment_id=payment.id,
                status=PaymentStatus.COMPLETED,
                stripe_data={
                    "transaction_id": payment_intent.get("latest_charge"),
                    "payment_date": datetime.fromtimestamp(
                        payment_intent["created"], tz=timezone.utc
                    ),
                    "extra_data": json.dumps(
                        {
                            "stripe_event": "payment_intent.succeeded",
                            "payment_method": payment_intent.get(
                                "payment_method_types", []
                            ),
                        }
                    ),
                },
            )

            logger.info(f"Payment {payment.id} marked as completed via webhook")

            # TODO: Send email confirmation
            # TODO: Update user package credits if applicable

    except Exception as e:
        logger.error(f"Error handling payment_intent.succeeded: {str(e)}")
        raise


async def handle_payment_intent_failed(payment_intent: dict, db: AsyncSession):
    """Handle failed payment intent."""
    try:
        payment_intent_id = payment_intent["id"]

        # Find payment record in database
        stmt = select(Payment).where(Payment.external_payment_id == payment_intent_id)
        result = await db.execute(stmt)
        payment = result.scalar_one_or_none()

        if payment:
            failure_reason = payment_intent.get("last_payment_error", {}).get(
                "message", "Payment failed"
            )

            await StripeService.update_payment_status(
                db=db,
                payment_id=payment.id,
                status=PaymentStatus.FAILED,
                stripe_data={
                    "extra_data": json.dumps(
                        {
                            "stripe_event": "payment_intent.payment_failed",
                            "failure_reason": failure_reason,
                            "error_code": payment_intent.get(
                                "last_payment_error", {}
                            ).get("code"),
                        }
                    )
                },
            )

            logger.info(
                f"Payment {payment.id} marked as failed via webhook: {failure_reason}"
            )

            # TODO: Send email notification about failed payment
            # TODO: Handle retry logic if applicable

    except Exception as e:
        logger.error(f"Error handling payment_intent.payment_failed: {str(e)}")
        raise


async def handle_invoice_payment_succeeded(invoice: dict, db: AsyncSession):
    """Handle successful invoice payment (for subscriptions)."""
    try:
        subscription_id = invoice.get("subscription")
        customer_id = invoice.get("customer")

        if subscription_id:
            # Find user by Stripe customer ID
            stmt = select(User).where(User.stripe_customer_id == customer_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()

            if user:
                # Create payment record for subscription
                await StripeService.create_payment_record(
                    db=db,
                    user_id=user.id,
                    amount=invoice["amount_paid"] / 100,  # Convert from cents
                    currency=invoice["currency"].upper(),
                    payment_type=PaymentType.PACKAGE_PURCHASE,  # Or create new SUBSCRIPTION type
                    stripe_payment_intent_id=invoice.get("payment_intent"),
                    description=f"Monthly subscription payment",
                    extra_data=json.dumps(
                        {
                            "stripe_event": "invoice.payment_succeeded",
                            "invoice_id": invoice["id"],
                            "subscription_id": subscription_id,
                            "billing_period_start": invoice.get("period_start"),
                            "billing_period_end": invoice.get("period_end"),
                        }
                    ),
                )

                logger.info(f"Subscription payment processed for user {user.id}")

                # TODO: Grant unlimited access for billing period
                # TODO: Send email receipt

    except Exception as e:
        logger.error(f"Error handling invoice.payment_succeeded: {str(e)}")
        raise


async def handle_invoice_payment_failed(invoice: dict, db: AsyncSession):
    """Handle failed invoice payment (for subscriptions)."""
    try:
        subscription_id = invoice.get("subscription")
        customer_id = invoice.get("customer")

        if subscription_id:
            # Find user by Stripe customer ID
            stmt = select(User).where(User.stripe_customer_id == customer_id)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()

            if user:
                logger.warning(f"Subscription payment failed for user {user.id}")

                # TODO: Implement dunning management
                # TODO: Send email notification about failed payment
                # TODO: Possibly suspend unlimited access after grace period

    except Exception as e:
        logger.error(f"Error handling invoice.payment_failed: {str(e)}")
        raise


async def handle_subscription_created(subscription: dict, db: AsyncSession):
    """Handle new subscription creation."""
    try:
        customer_id = subscription.get("customer")

        # Find user by Stripe customer ID
        stmt = select(User).where(User.stripe_customer_id == customer_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            logger.info(f"New subscription created for user {user.id}")

            # TODO: Store subscription details in database
            # TODO: Grant unlimited access
            # TODO: Send welcome email

    except Exception as e:
        logger.error(f"Error handling customer.subscription.created: {str(e)}")
        raise


async def handle_subscription_updated(subscription: dict, db: AsyncSession):
    """Handle subscription updates."""
    try:
        customer_id = subscription.get("customer")
        status = subscription.get("status")

        # Find user by Stripe customer ID
        stmt = select(User).where(User.stripe_customer_id == customer_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            logger.info(f"Subscription updated for user {user.id}, status: {status}")

            # TODO: Update subscription status in database
            # TODO: Handle status changes (active, past_due, canceled, etc.)

    except Exception as e:
        logger.error(f"Error handling customer.subscription.updated: {str(e)}")
        raise


async def handle_subscription_deleted(subscription: dict, db: AsyncSession):
    """Handle subscription cancellation."""
    try:
        customer_id = subscription.get("customer")

        # Find user by Stripe customer ID
        stmt = select(User).where(User.stripe_customer_id == customer_id)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()

        if user:
            logger.info(f"Subscription cancelled for user {user.id}")

            # TODO: Revoke unlimited access
            # TODO: Send cancellation confirmation email

    except Exception as e:
        logger.error(f"Error handling customer.subscription.deleted: {str(e)}")
        raise


async def handle_dispute_created(charge: dict, db: AsyncSession):
    """Handle charge dispute/chargeback."""
    try:
        charge_id = charge.get("id")
        amount = charge.get("amount")

        logger.warning(f"Dispute created for charge {charge_id}, amount: {amount}")

        # TODO: Find related payment and mark as disputed
        # TODO: Send notification to admin
        # TODO: Implement dispute handling workflow

    except Exception as e:
        logger.error(f"Error handling charge.dispute.created: {str(e)}")
        raise
