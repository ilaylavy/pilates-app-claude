"""
Mock Stripe service for testing payment functionality.
"""

from unittest.mock import MagicMock
from typing import Dict, Any, Optional
from decimal import Decimal


class MockStripeService:
    """Mock implementation of Stripe service for testing."""
    
    def __init__(self):
        self.payment_intents = {}
        self.customers = {}
        self.charges = {}
        self.refunds = {}
        self._next_id = 1
    
    def _generate_id(self, prefix: str) -> str:
        """Generate a mock Stripe ID."""
        id_val = f"{prefix}_test_{self._next_id}"
        self._next_id += 1
        return id_val
    
    def create_payment_intent(
        self,
        amount: int,
        currency: str = "usd",
        customer_id: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Mock payment intent creation."""
        intent_id = self._generate_id("pi")
        
        payment_intent = {
            "id": intent_id,
            "amount": amount,
            "currency": currency,
            "status": "requires_payment_method",
            "client_secret": f"{intent_id}_secret_test",
            "customer": customer_id,
            "metadata": metadata or {},
            "created": 1638360000,
        }
        
        self.payment_intents[intent_id] = payment_intent
        return payment_intent
    
    def confirm_payment_intent(self, intent_id: str) -> Dict[str, Any]:
        """Mock payment intent confirmation."""
        if intent_id not in self.payment_intents:
            raise Exception(f"Payment intent {intent_id} not found")
        
        self.payment_intents[intent_id]["status"] = "succeeded"
        return self.payment_intents[intent_id]
    
    def create_customer(
        self,
        email: str,
        name: Optional[str] = None,
        metadata: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Mock customer creation."""
        customer_id = self._generate_id("cus")
        
        customer = {
            "id": customer_id,
            "email": email,
            "name": name,
            "metadata": metadata or {},
            "created": 1638360000,
        }
        
        self.customers[customer_id] = customer
        return customer
    
    def create_refund(
        self,
        payment_intent_id: str,
        amount: Optional[int] = None,
        reason: str = "requested_by_customer"
    ) -> Dict[str, Any]:
        """Mock refund creation."""
        if payment_intent_id not in self.payment_intents:
            raise Exception(f"Payment intent {payment_intent_id} not found")
        
        refund_id = self._generate_id("re")
        payment_intent = self.payment_intents[payment_intent_id]
        refund_amount = amount or payment_intent["amount"]
        
        refund = {
            "id": refund_id,
            "amount": refund_amount,
            "currency": payment_intent["currency"],
            "payment_intent": payment_intent_id,
            "reason": reason,
            "status": "succeeded",
            "created": 1638360000,
        }
        
        self.refunds[refund_id] = refund
        return refund
    
    def retrieve_payment_intent(self, intent_id: str) -> Dict[str, Any]:
        """Mock payment intent retrieval."""
        if intent_id not in self.payment_intents:
            raise Exception(f"Payment intent {intent_id} not found")
        
        return self.payment_intents[intent_id]
    
    def retrieve_customer(self, customer_id: str) -> Dict[str, Any]:
        """Mock customer retrieval."""
        if customer_id not in self.customers:
            raise Exception(f"Customer {customer_id} not found")
        
        return self.customers[customer_id]
    
    def simulate_webhook_event(
        self,
        event_type: str,
        object_id: str,
        data: Optional[Dict] = None
    ) -> Dict[str, Any]:
        """Simulate a Stripe webhook event."""
        return {
            "id": self._generate_id("evt"),
            "type": event_type,
            "data": {
                "object": data or self._get_object_by_id(object_id)
            },
            "created": 1638360000,
            "livemode": False,
        }
    
    def _get_object_by_id(self, object_id: str) -> Dict[str, Any]:
        """Get object by ID for webhook simulation."""
        if object_id.startswith("pi_"):
            return self.payment_intents.get(object_id, {})
        elif object_id.startswith("cus_"):
            return self.customers.get(object_id, {})
        elif object_id.startswith("re_"):
            return self.refunds.get(object_id, {})
        else:
            return {}


def get_mock_stripe_service() -> MockStripeService:
    """Get a configured mock Stripe service."""
    return MockStripeService()


class MockStripeError:
    """Mock Stripe error classes."""
    
    class InvalidRequestError(Exception):
        """Mock Stripe InvalidRequestError."""
        pass
    
    class CardError(Exception):
        """Mock Stripe CardError."""
        pass
    
    class RateLimitError(Exception):
        """Mock Stripe RateLimitError."""
        pass
    
    class APIConnectionError(Exception):
        """Mock Stripe APIConnectionError."""
        pass