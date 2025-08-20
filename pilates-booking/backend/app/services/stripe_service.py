import stripe
from typing import Optional, Dict, Any, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import logging
from decimal import Decimal

from ..core.config import settings
from ..models.user import User
from ..models.payment import Payment, PaymentStatus, PaymentMethod, PaymentType
from ..models.package import Package

# Configure Stripe
stripe.api_key = settings.STRIPE_SECRET_KEY

logger = logging.getLogger(__name__)


class StripeService:
    """Service for handling Stripe payment operations."""
    
    @staticmethod
    async def create_or_get_customer(user: User, db: AsyncSession) -> str:
        """Create or retrieve existing Stripe customer for user."""
        try:
            # Check if user already has a Stripe customer ID
            if user.stripe_customer_id:
                # Verify the customer exists in Stripe
                try:
                    customer = stripe.Customer.retrieve(user.stripe_customer_id)
                    return customer.id
                except stripe.error.InvalidRequestError:
                    # Customer doesn't exist, create new one
                    pass
            
            # Create new Stripe customer
            customer = stripe.Customer.create(
                email=user.email,
                name=f"{user.first_name} {user.last_name}" if user.first_name and user.last_name else user.email,
                metadata={
                    "user_id": str(user.id),
                    "environment": settings.ENVIRONMENT
                }
            )
            
            # Update user with Stripe customer ID
            user.stripe_customer_id = customer.id
            await db.commit()
            
            logger.info(f"Created Stripe customer {customer.id} for user {user.id}")
            return customer.id
            
        except Exception as e:
            logger.error(f"Failed to create/get Stripe customer for user {user.id}: {str(e)}")
            raise
    
    @staticmethod
    async def create_payment_intent(
        amount: Decimal, 
        currency: str,
        customer_id: str,
        package_id: Optional[int] = None,
        user_package_id: Optional[int] = None,
        description: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> stripe.PaymentIntent:
        """Create a payment intent for package purchase."""
        try:
            # Convert amount to cents/agorot for Stripe
            amount_cents = int(amount * 100)
            
            payment_intent_data = {
                "amount": amount_cents,
                "currency": currency.lower(),
                "customer": customer_id,
                "automatic_payment_methods": {"enabled": True},
                "metadata": metadata or {}
            }
            
            if description:
                payment_intent_data["description"] = description
            
            # Add package information to metadata
            if package_id:
                payment_intent_data["metadata"]["package_id"] = str(package_id)
            if user_package_id:
                payment_intent_data["metadata"]["user_package_id"] = str(user_package_id)
            
            payment_intent = stripe.PaymentIntent.create(**payment_intent_data)
            
            logger.info(f"Created payment intent {payment_intent.id} for customer {customer_id}")
            return payment_intent
            
        except Exception as e:
            logger.error(f"Failed to create payment intent: {str(e)}")
            raise
    
    @staticmethod
    async def confirm_payment_intent(payment_intent_id: str) -> stripe.PaymentIntent:
        """Confirm a payment intent."""
        try:
            payment_intent = stripe.PaymentIntent.retrieve(payment_intent_id)
            
            if payment_intent.status == "requires_confirmation":
                payment_intent = stripe.PaymentIntent.confirm(payment_intent_id)
            
            return payment_intent
            
        except Exception as e:
            logger.error(f"Failed to confirm payment intent {payment_intent_id}: {str(e)}")
            raise
    
    @staticmethod
    async def create_payment_record(
        db: AsyncSession,
        user_id: int,
        amount: Decimal,
        currency: str,
        payment_type: PaymentType,
        package_id: Optional[int] = None,
        user_package_id: Optional[int] = None,
        stripe_payment_intent_id: Optional[str] = None,
        description: Optional[str] = None,
        extra_data: Optional[str] = None
    ) -> Payment:
        """Create a payment record in the database."""
        try:
            payment = Payment(
                user_id=user_id,
                package_id=package_id,
                user_package_id=user_package_id,
                amount=amount,
                currency=currency,
                payment_type=payment_type,
                payment_method=PaymentMethod.STRIPE,
                status=PaymentStatus.PENDING,
                external_payment_id=stripe_payment_intent_id,
                description=description,
                extra_data=extra_data
            )
            
            db.add(payment)
            await db.commit()
            await db.refresh(payment)
            
            logger.info(f"Created payment record {payment.id} for user {user_id}")
            return payment
            
        except Exception as e:
            logger.error(f"Failed to create payment record: {str(e)}")
            raise
    
    @staticmethod
    async def update_payment_status(
        db: AsyncSession, 
        payment_id: int, 
        status: PaymentStatus, 
        stripe_data: Optional[Dict[str, Any]] = None
    ) -> Payment:
        """Update payment status and Stripe data."""
        try:
            stmt = select(Payment).where(Payment.id == payment_id)
            result = await db.execute(stmt)
            payment = result.scalar_one_or_none()
            
            if not payment:
                raise ValueError(f"Payment {payment_id} not found")
            
            payment.status = status
            
            if stripe_data:
                if "transaction_id" in stripe_data:
                    payment.external_transaction_id = stripe_data["transaction_id"]
                if "payment_date" in stripe_data:
                    payment.payment_date = stripe_data["payment_date"]
                if "extra_data" in stripe_data:
                    payment.extra_data = stripe_data["extra_data"]
            
            await db.commit()
            await db.refresh(payment)
            
            logger.info(f"Updated payment {payment_id} status to {status}")
            return payment
            
        except Exception as e:
            logger.error(f"Failed to update payment status: {str(e)}")
            raise
    
    @staticmethod
    async def get_customer_payment_methods(customer_id: str) -> List[Dict[str, Any]]:
        """Get saved payment methods for a customer."""
        try:
            payment_methods = stripe.PaymentMethod.list(
                customer=customer_id,
                type="card"
            )
            
            return [
                {
                    "id": pm.id,
                    "card": {
                        "brand": pm.card.brand,
                        "last4": pm.card.last4,
                        "exp_month": pm.card.exp_month,
                        "exp_year": pm.card.exp_year
                    },
                    "created": pm.created
                }
                for pm in payment_methods.data
            ]
            
        except Exception as e:
            logger.error(f"Failed to get customer payment methods: {str(e)}")
            raise
    
    @staticmethod
    async def process_refund(
        payment_intent_id: str, 
        amount: Optional[int] = None,
        reason: str = "requested_by_customer"
    ) -> stripe.Refund:
        """Process a refund for a payment intent."""
        try:
            refund_data = {
                "payment_intent": payment_intent_id,
                "reason": reason
            }
            
            if amount:
                refund_data["amount"] = amount
            
            refund = stripe.Refund.create(**refund_data)
            
            logger.info(f"Created refund {refund.id} for payment intent {payment_intent_id}")
            return refund
            
        except Exception as e:
            logger.error(f"Failed to process refund: {str(e)}")
            raise
    
    @staticmethod
    async def create_subscription(
        customer_id: str,
        price_id: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> stripe.Subscription:
        """Create a monthly subscription for unlimited access."""
        try:
            subscription = stripe.Subscription.create(
                customer=customer_id,
                items=[{"price": price_id}],
                metadata=metadata or {},
                payment_behavior="default_incomplete",
                payment_settings={"save_default_payment_method": "on_subscription"},
                expand=["latest_invoice.payment_intent"]
            )
            
            logger.info(f"Created subscription {subscription.id} for customer {customer_id}")
            return subscription
            
        except Exception as e:
            logger.error(f"Failed to create subscription: {str(e)}")
            raise
    
    @staticmethod
    async def cancel_subscription(subscription_id: str) -> stripe.Subscription:
        """Cancel a subscription."""
        try:
            subscription = stripe.Subscription.modify(
                subscription_id,
                cancel_at_period_end=True
            )
            
            logger.info(f"Cancelled subscription {subscription_id}")
            return subscription
            
        except Exception as e:
            logger.error(f"Failed to cancel subscription: {str(e)}")
            raise
    
    @staticmethod
    async def retrieve_invoice(invoice_id: str) -> stripe.Invoice:
        """Retrieve a Stripe invoice."""
        try:
            invoice = stripe.Invoice.retrieve(invoice_id)
            return invoice
            
        except Exception as e:
            logger.error(f"Failed to retrieve invoice {invoice_id}: {str(e)}")
            raise