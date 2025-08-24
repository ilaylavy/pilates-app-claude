"""
End-to-End Tests for Payment and Subscription Workflows

Tests critical payment scenarios including:
1. Package purchase with Stripe integration
2. Payment failure handling
3. Subscription management
4. Refund processing
5. Package expiration scenarios
"""

import pytest
import asyncio
from datetime import datetime, timedelta
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.package import Package
from app.models.user_package import UserPackage
from app.models.payment import Payment, PaymentStatus
from tests.factories import UserFactory, PackageFactory


@pytest.mark.e2e
class TestPaymentWorkflows:
    """Test payment processing workflows end-to-end."""

    @pytest.fixture
    async def verified_user(self, db_session: AsyncSession):
        """Create a verified user for payment testing."""
        user = UserFactory(
            email="paymentuser@example.com",
            role=UserRole.STUDENT,
            is_verified=True,
            is_active=True
        )
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        return user

    @pytest.fixture
    async def premium_package(self, db_session: AsyncSession):
        """Create a premium package for purchase testing."""
        package = PackageFactory(
            name="Premium Unlimited",
            description="Unlimited classes for 30 days",
            price=Decimal("199.99"),
            credits=None,  # Unlimited
            is_unlimited=True,
            validity_days=30,
            is_active=True
        )
        db_session.add(package)
        await db_session.commit()
        await db_session.refresh(package)
        return package

    @pytest.fixture
    async def basic_package(self, db_session: AsyncSession):
        """Create a basic package for testing."""
        package = PackageFactory(
            name="Basic 5-Class Pack",
            description="5 pilates classes",
            price=Decimal("75.00"),
            credits=5,
            is_unlimited=False,
            validity_days=60,
            is_active=True
        )
        db_session.add(package)
        await db_session.commit()
        await db_session.refresh(package)
        return package

    async def authenticate_user(self, client: TestClient, user: User):
        """Helper to authenticate a user and return headers."""
        # In a real implementation, this would go through proper login flow
        # For E2E testing, we'll simulate the authentication token
        headers = {"user_id": str(user.id)}  # Simplified auth for testing
        return headers

    @pytest.mark.asyncio
    async def test_successful_package_purchase_workflow(
        self, 
        client: TestClient,
        db_session: AsyncSession,
        verified_user,
        premium_package
    ):
        """Test successful package purchase with payment processing."""
        
        headers = await self.authenticate_user(client, verified_user)
        
        # Step 1: User views available packages
        response = client.get("/api/v1/packages", headers=headers)
        assert response.status_code == 200
        packages = response.json()
        
        target_package = next(p for p in packages if p["id"] == premium_package.id)
        assert float(target_package["price"]) == 199.99
        assert target_package["is_unlimited"] is True
        
        # Step 2: User initiates payment
        payment_data = {
            "package_id": premium_package.id,
            "payment_method_id": "pm_card_visa",  # Stripe test payment method
            "currency": "usd"
        }
        
        # This would create a Stripe payment intent
        response = client.post("/api/v1/payments/create-intent", json=payment_data, headers=headers)
        assert response.status_code == 200
        payment_intent = response.json()
        
        assert "client_secret" in payment_intent
        assert payment_intent["amount"] == 19999  # $199.99 in cents
        assert payment_intent["currency"] == "usd"
        
        # Step 3: Simulate successful payment confirmation
        confirmation_data = {
            "payment_intent_id": payment_intent["payment_intent_id"],
            "package_id": premium_package.id,
            "status": "succeeded"
        }
        
        response = client.post("/api/v1/payments/confirm", json=confirmation_data, headers=headers)
        assert response.status_code == 200
        confirmation_response = response.json()
        
        assert confirmation_response["payment_status"] == "succeeded"
        assert "user_package_id" in confirmation_response
        user_package_id = confirmation_response["user_package_id"]
        
        # Step 4: Verify user package was created
        response = client.get("/api/v1/users/me", headers=headers)
        assert response.status_code == 200
        user_data = response.json()
        
        user_packages = user_data.get("packages", [])
        assert len(user_packages) > 0
        
        purchased_package = next(p for p in user_packages if p["id"] == user_package_id)
        assert purchased_package["package"]["name"] == "Premium Unlimited"
        assert purchased_package["is_unlimited"] is True
        assert purchased_package["is_active"] is True
        
        # Step 5: Verify payment record in database
        payment_record = await db_session.execute(
            f"SELECT * FROM payments WHERE user_id = {verified_user.id} ORDER BY created_at DESC LIMIT 1"
        )
        payment = payment_record.fetchone()
        assert payment is not None
        assert payment.status == PaymentStatus.SUCCEEDED
        assert payment.amount == Decimal("199.99")
        
        print("✅ Successful package purchase workflow test passed!")

    @pytest.mark.asyncio
    async def test_payment_failure_workflow(
        self,
        client: TestClient,
        db_session: AsyncSession,
        verified_user,
        basic_package
    ):
        """Test payment failure handling."""
        
        headers = await self.authenticate_user(client, verified_user)
        
        # Step 1: User attempts to purchase package
        payment_data = {
            "package_id": basic_package.id,
            "payment_method_id": "pm_card_visa_chargeDeclined",  # Test card that fails
            "currency": "usd"
        }
        
        response = client.post("/api/v1/payments/create-intent", json=payment_data, headers=headers)
        assert response.status_code == 200
        payment_intent = response.json()
        
        # Step 2: Simulate payment failure
        confirmation_data = {
            "payment_intent_id": payment_intent["payment_intent_id"],
            "package_id": basic_package.id,
            "status": "payment_failed",
            "error_message": "Your card was declined."
        }
        
        response = client.post("/api/v1/payments/confirm", json=confirmation_data, headers=headers)
        assert response.status_code == 400  # Bad request for failed payment
        error_response = response.json()
        
        assert "error" in error_response
        assert "declined" in error_response["error"].lower()
        
        # Step 3: Verify no user package was created
        response = client.get("/api/v1/users/me", headers=headers)
        user_data = response.json()
        user_packages = user_data.get("packages", [])
        
        # Should have no packages from this failed purchase
        basic_packages = [p for p in user_packages if p["package"]["id"] == basic_package.id]
        assert len(basic_packages) == 0
        
        # Step 4: Verify failed payment record
        payment_record = await db_session.execute(
            f"SELECT * FROM payments WHERE user_id = {verified_user.id} AND status = 'failed' ORDER BY created_at DESC LIMIT 1"
        )
        failed_payment = payment_record.fetchone()
        assert failed_payment is not None
        assert failed_payment.status == PaymentStatus.FAILED
        
        print("✅ Payment failure workflow test passed!")

    @pytest.mark.asyncio
    async def test_package_expiration_workflow(
        self,
        client: TestClient,
        db_session: AsyncSession,
        verified_user,
        basic_package
    ):
        """Test package expiration handling."""
        
        headers = await self.authenticate_user(client, verified_user)
        
        # Step 1: Create an expired user package
        expired_package = UserPackage(
            user_id=verified_user.id,
            package_id=basic_package.id,
            remaining_credits=3,
            expires_at=datetime.utcnow() - timedelta(days=1),  # Expired yesterday
            is_active=True
        )
        db_session.add(expired_package)
        await db_session.commit()
        
        # Step 2: Run package expiration check (background job simulation)
        response = client.post("/api/v1/admin/tasks/expire-packages", headers={"admin": "true"})
        assert response.status_code == 200
        expiration_result = response.json()
        
        assert expiration_result["expired_packages"] >= 1
        
        # Step 3: Verify package is now inactive
        await db_session.refresh(expired_package)
        assert expired_package.is_active is False
        
        # Step 4: Verify user cannot use expired package for booking
        response = client.get("/api/v1/users/me", headers=headers)
        user_data = response.json()
        
        active_packages = [p for p in user_data.get("packages", []) if p["is_active"]]
        expired_package_ids = [p["id"] for p in active_packages]
        assert expired_package.id not in expired_package_ids
        
        print("✅ Package expiration workflow test passed!")

    @pytest.mark.asyncio
    async def test_refund_processing_workflow(
        self,
        client: TestClient,
        db_session: AsyncSession,
        verified_user,
        basic_package
    ):
        """Test refund processing for package purchases."""
        
        headers = await self.authenticate_user(client, verified_user)
        
        # Step 1: User purchases package (successful)
        user_package = UserPackage(
            user_id=verified_user.id,
            package_id=basic_package.id,
            remaining_credits=5,
            expires_at=datetime.utcnow() + timedelta(days=60),
            is_active=True
        )
        db_session.add(user_package)
        
        # Create associated payment record
        payment = Payment(
            user_id=verified_user.id,
            package_id=basic_package.id,
            stripe_payment_intent_id="pi_test_success",
            amount=basic_package.price,
            currency="usd",
            status=PaymentStatus.SUCCEEDED
        )
        db_session.add(payment)
        await db_session.commit()
        await db_session.refresh(user_package)
        await db_session.refresh(payment)
        
        # Step 2: User requests refund (within refund window)
        refund_data = {
            "user_package_id": user_package.id,
            "reason": "Changed mind about membership",
            "refund_type": "full"
        }
        
        response = client.post("/api/v1/payments/refund", json=refund_data, headers=headers)
        assert response.status_code == 200
        refund_response = response.json()
        
        assert refund_response["refund_status"] == "processing"
        assert "refund_id" in refund_response
        
        # Step 3: Simulate Stripe webhook confirming refund
        webhook_data = {
            "type": "charge.dispute.created",
            "data": {
                "object": {
                    "payment_intent": payment.stripe_payment_intent_id,
                    "amount_refunded": int(payment.amount * 100),  # Convert to cents
                    "status": "refunded"
                }
            }
        }
        
        response = client.post("/api/v1/webhooks/stripe", json=webhook_data)
        assert response.status_code == 200
        
        # Step 4: Verify user package is deactivated
        await db_session.refresh(user_package)
        assert user_package.is_active is False
        
        # Step 5: Verify payment status updated
        await db_session.refresh(payment)
        assert payment.status == PaymentStatus.REFUNDED
        
        print("✅ Refund processing workflow test passed!")


@pytest.mark.e2e
class TestSubscriptionWorkflows:
    """Test subscription-based package workflows."""
    
    @pytest.fixture
    async def monthly_subscription_package(self, db_session: AsyncSession):
        """Create a monthly subscription package."""
        package = PackageFactory(
            name="Monthly Unlimited",
            description="Unlimited classes with monthly billing",
            price=Decimal("149.99"),
            credits=None,
            is_unlimited=True,
            validity_days=30,
            is_subscription=True,
            is_active=True
        )
        db_session.add(package)
        await db_session.commit()
        await db_session.refresh(package)
        return package

    @pytest.mark.asyncio
    async def test_subscription_renewal_workflow(
        self,
        client: TestClient,
        db_session: AsyncSession,
        verified_user,
        monthly_subscription_package
    ):
        """Test automatic subscription renewal."""
        
        headers = await self.authenticate_user(client, verified_user)
        
        # Step 1: User subscribes to monthly package
        user_package = UserPackage(
            user_id=verified_user.id,
            package_id=monthly_subscription_package.id,
            remaining_credits=None,  # Unlimited
            expires_at=datetime.utcnow() + timedelta(days=30),
            is_active=True,
            is_subscription=True,
            stripe_subscription_id="sub_test_subscription"
        )
        db_session.add(user_package)
        await db_session.commit()
        
        # Step 2: Simulate Stripe subscription renewal webhook
        renewal_webhook = {
            "type": "invoice.payment_succeeded",
            "data": {
                "object": {
                    "subscription": "sub_test_subscription",
                    "amount_paid": 14999,  # $149.99 in cents
                    "currency": "usd",
                    "period_start": int(datetime.utcnow().timestamp()),
                    "period_end": int((datetime.utcnow() + timedelta(days=30)).timestamp())
                }
            }
        }
        
        response = client.post("/api/v1/webhooks/stripe", json=renewal_webhook)
        assert response.status_code == 200
        
        # Step 3: Verify subscription was renewed
        await db_session.refresh(user_package)
        new_expiry = user_package.expires_at
        expected_expiry = datetime.utcnow() + timedelta(days=30)
        
        # Should be approximately 30 days from now (within 1 day tolerance)
        assert abs((new_expiry - expected_expiry).days) <= 1
        assert user_package.is_active is True
        
        print("✅ Subscription renewal workflow test passed!")

    @pytest.mark.asyncio
    async def test_subscription_cancellation_workflow(
        self,
        client: TestClient,
        db_session: AsyncSession,
        verified_user,
        monthly_subscription_package
    ):
        """Test subscription cancellation."""
        
        headers = await self.authenticate_user(client, verified_user)
        
        # Step 1: User has active subscription
        user_package = UserPackage(
            user_id=verified_user.id,
            package_id=monthly_subscription_package.id,
            remaining_credits=None,
            expires_at=datetime.utcnow() + timedelta(days=20),  # 20 days left
            is_active=True,
            is_subscription=True,
            stripe_subscription_id="sub_test_cancel"
        )
        db_session.add(user_package)
        await db_session.commit()
        
        # Step 2: User requests cancellation
        cancellation_data = {
            "user_package_id": user_package.id,
            "cancel_at_period_end": True,
            "reason": "Moving to different location"
        }
        
        response = client.post("/api/v1/subscriptions/cancel", json=cancellation_data, headers=headers)
        assert response.status_code == 200
        cancellation_response = response.json()
        
        assert cancellation_response["status"] == "cancelled"
        assert cancellation_response["cancel_at_period_end"] is True
        
        # Step 3: Verify subscription remains active until period end
        await db_session.refresh(user_package)
        assert user_package.is_active is True  # Still active until expiry
        assert user_package.will_auto_renew is False  # But won't renew
        
        # Step 4: Simulate period end
        user_package.expires_at = datetime.utcnow() - timedelta(minutes=1)  # Just expired
        await db_session.commit()
        
        # Run expiration job
        response = client.post("/api/v1/admin/tasks/expire-packages", headers={"admin": "true"})
        assert response.status_code == 200
        
        # Step 5: Verify subscription is now inactive
        await db_session.refresh(user_package)
        assert user_package.is_active is False
        
        print("✅ Subscription cancellation workflow test passed!")


if __name__ == "__main__":
    """Run payment E2E tests independently."""
    pytest.main([__file__, "-v", "-k", "e2e"])