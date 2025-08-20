#!/usr/bin/env python3
"""
Script to test Stripe webhook endpoint locally.
This simulates what Stripe would send to your webhook.
"""

import requests
import json
import hmac
import hashlib
import time
from typing import Dict, Any

# Configuration
WEBHOOK_URL = "http://localhost:8000/api/v1/webhooks/stripe"
WEBHOOK_SECRET = "whsec_test_webhook_secret_for_testing"  # Use this for testing

def create_stripe_signature(payload: bytes, secret: str, timestamp: int) -> str:
    """Create a Stripe webhook signature for testing."""
    # Remove 'whsec_' prefix from secret
    key = secret[6:] if secret.startswith('whsec_') else secret
    
    # Create the signed payload
    signed_payload = f"{timestamp}.{payload.decode()}"
    signature = hmac.new(
        key.encode(),
        signed_payload.encode(),
        hashlib.sha256
    ).hexdigest()
    
    return f"t={timestamp},v1={signature}"

def test_webhook_endpoint(event_type: str, event_data: Dict[str, Any]):
    """Test a webhook endpoint with a specific event."""
    
    # Create the webhook payload
    event = {
        "id": f"evt_test_{int(time.time())}",
        "object": "event",
        "api_version": "2023-10-16",
        "created": int(time.time()),
        "data": {
            "object": event_data
        },
        "livemode": False,
        "pending_webhooks": 1,
        "request": {
            "id": None,
            "idempotency_key": None
        },
        "type": event_type
    }
    
    # Convert to JSON
    payload = json.dumps(event).encode()
    timestamp = int(time.time())
    
    # Create signature
    signature = create_stripe_signature(payload, WEBHOOK_SECRET, timestamp)
    
    # Set headers
    headers = {
        "Content-Type": "application/json",
        "Stripe-Signature": signature,
        "User-Agent": "Stripe/1.0 (+https://stripe.com/docs/webhooks)"
    }
    
    try:
        print(f"\\n🧪 Testing webhook: {event_type}")
        print(f"URL: {WEBHOOK_URL}")
        print(f"Payload size: {len(payload)} bytes")
        
        response = requests.post(WEBHOOK_URL, data=payload, headers=headers, timeout=10)
        
        print(f"✅ Status: {response.status_code}")
        if response.status_code == 200:
            print(f"✅ Response: {response.json()}")
        else:
            print(f"❌ Error: {response.text}")
            
    except requests.exceptions.RequestException as e:
        print(f"❌ Connection Error: {e}")
        print("Make sure your backend is running on localhost:8000")

def test_payment_intent_succeeded():
    """Test payment_intent.succeeded event."""
    event_data = {
        "id": "pi_test_payment_intent_123",
        "object": "payment_intent",
        "amount": 5000,  # $50.00 in cents
        "currency": "ils",
        "status": "succeeded",
        "created": int(time.time()),
        "latest_charge": "ch_test_charge_123",
        "payment_method_types": ["card"]
    }
    test_webhook_endpoint("payment_intent.succeeded", event_data)

def test_payment_intent_failed():
    """Test payment_intent.payment_failed event."""
    event_data = {
        "id": "pi_test_payment_intent_456",
        "object": "payment_intent",
        "amount": 5000,
        "currency": "ils",
        "status": "payment_failed",
        "created": int(time.time()),
        "last_payment_error": {
            "code": "card_declined",
            "message": "Your card was declined."
        }
    }
    test_webhook_endpoint("payment_intent.payment_failed", event_data)

def test_subscription_created():
    """Test customer.subscription.created event."""
    event_data = {
        "id": "sub_test_subscription_123",
        "object": "subscription",
        "customer": "cus_test_customer_123",
        "status": "active",
        "created": int(time.time()),
        "current_period_start": int(time.time()),
        "current_period_end": int(time.time()) + 2592000,  # 30 days
    }
    test_webhook_endpoint("customer.subscription.created", event_data)

def main():
    """Run all webhook tests."""
    print("🚀 Starting Stripe Webhook Tests")
    print("=" * 50)
    
    # Test different webhook events
    test_payment_intent_succeeded()
    test_payment_intent_failed()
    test_subscription_created()
    
    print("\\n" + "=" * 50)
    print("✅ Webhook testing completed!")
    print("\\nTo use real Stripe webhooks:")
    print("1. Update STRIPE_WEBHOOK_SECRET in your .env file")
    print("2. Add your webhook endpoint in Stripe Dashboard")
    print("3. Use Stripe CLI: stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe")

if __name__ == "__main__":
    main()