# Stripe Payment System Documentation

This document provides comprehensive documentation for the integrated Stripe payment system in the Pilates Booking Application.

## Table of Contents

- [Overview](#overview)
- [Backend Implementation](#backend-implementation)
- [Mobile Implementation](#mobile-implementation)
- [Configuration](#configuration)
- [API Endpoints](#api-endpoints)
- [Payment Flow](#payment-flow)
- [Testing](#testing)
- [Security](#security)
- [Troubleshooting](#troubleshooting)

## Overview

The payment system integrates Stripe to handle:
- Package purchases with credit/debit cards
- Apple Pay and Google Pay support
- Monthly unlimited subscriptions
- Payment history and invoicing
- Refund processing
- Webhook event handling

### Architecture

```
Mobile App (React Native)
    ↓ (Payment Intent Creation)
Backend API (FastAPI)
    ↓ (Stripe API Calls)
Stripe Payment Processing
    ↓ (Webhooks)
Backend Webhook Handler
    ↓ (Database Updates)
PostgreSQL Database
```

## Backend Implementation

### Dependencies

Added to `requirements.txt`:
```
stripe==8.7.0
```

### Database Changes

**New field in users table:**
- `stripe_customer_id`: String field to store Stripe customer IDs

**Migration file:** `c9f8d1234567_add_stripe_customer_id_to_users.py`

### Core Services

#### StripeService (`app/services/stripe_service.py`)

Main service class handling all Stripe operations:

**Key Methods:**
- `create_or_get_customer()`: Creates/retrieves Stripe customers
- `create_payment_intent()`: Creates payment intents for purchases
- `confirm_payment_intent()`: Confirms successful payments
- `create_payment_record()`: Stores payment records in database
- `update_payment_status()`: Updates payment status
- `get_customer_payment_methods()`: Retrieves saved payment methods
- `process_refund()`: Handles refund processing
- `create_subscription()`: Creates monthly subscriptions
- `cancel_subscription()`: Cancels subscriptions

### API Endpoints

#### Payment Endpoints (`app/api/v1/endpoints/payments.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/payments/create-payment-intent` | Create payment intent for package purchase |
| POST | `/api/v1/payments/confirm-payment` | Confirm completed payment |
| GET | `/api/v1/payments/methods` | Get saved payment methods |
| POST | `/api/v1/payments/refund/{payment_id}` | Process refund (admin only) |
| GET | `/api/v1/payments/history` | Get payment history |
| GET | `/api/v1/payments/invoices/{invoice_id}` | Get invoice details |
| POST | `/api/v1/payments/subscriptions` | Create subscription |
| DELETE | `/api/v1/payments/subscriptions/{id}` | Cancel subscription |

#### Webhook Endpoints (`app/api/v1/endpoints/webhooks.py`)

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/webhooks/stripe` | Handle Stripe webhook events |

**Supported Webhook Events:**
- `payment_intent.succeeded`
- `payment_intent.payment_failed`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.dispute.created`

### Configuration

In `app/core/config.py`:

```python
# Stripe Configuration
STRIPE_SECRET_KEY: str = "sk_test_51234567890abcdef"
STRIPE_PUBLISHABLE_KEY: str = "pk_test_51234567890abcdef"
STRIPE_WEBHOOK_SECRET: str = "whsec_test_1234567890abcdef"
STRIPE_CURRENCY: str = "ils"  # Israeli Shekel
STRIPE_MONTHLY_SUBSCRIPTION_PRICE_ID: str = "price_1234567890abcdef"
```

## Mobile Implementation

### Dependencies

Added to `package.json`:
```json
"@stripe/stripe-react-native": "^0.38.6"
```

### App Setup

**App.tsx** wrapped with StripeProvider:
```typescript
import { StripeProvider } from '@stripe/stripe-react-native';
import { STRIPE_PUBLISHABLE_KEY } from './src/utils/config';

<StripeProvider publishableKey={STRIPE_PUBLISHABLE_KEY}>
  {/* App components */}
</StripeProvider>
```

### Core Components

#### PaymentScreen (`src/screens/PaymentScreen.tsx`)

Full-featured payment screen with:
- Credit card input using Stripe CardField
- Apple Pay integration (iOS)
- Google Pay integration (Android)
- Payment method selection
- Loading states and error handling
- 3D Secure authentication support

#### PaymentHistoryScreen (`src/screens/PaymentHistoryScreen.tsx`)

Displays user's payment history with:
- Paginated payment list
- Payment status indicators
- Invoice access
- Refund information
- Pull-to-refresh functionality

### API Client (`src/api/payments.ts`)

Centralized API calls for payment operations:
- `createPaymentIntent()`
- `confirmPayment()`
- `getPaymentMethods()`
- `getPaymentHistory()`
- `getInvoice()`
- `createSubscription()`
- `cancelSubscription()`

### Navigation

Added routes in `Navigation.tsx`:
- `Payment`: Payment processing screen
- `PaymentHistory`: Payment history screen

### Updated Components

**PurchaseModal** (`src/components/PurchaseModal.tsx`):
- Now redirects to PaymentScreen for card payments
- Maintains legacy flow for bank/cash payments

## Configuration

### Backend Configuration

1. **Environment Variables** (recommended):
```bash
STRIPE_SECRET_KEY=sk_test_your_secret_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
STRIPE_MONTHLY_SUBSCRIPTION_PRICE_ID=price_your_price_id
```

2. **Stripe Dashboard Setup**:
   - Create products and prices for subscriptions
   - Set up webhook endpoints
   - Configure payment methods

### Mobile Configuration

In `src/utils/config.ts`:
```typescript
export const STRIPE_PUBLISHABLE_KEY = __DEV__
  ? 'pk_test_your_test_key'
  : 'pk_live_your_live_key';
```

## API Endpoints

### Payment Intent Creation

**POST** `/api/v1/payments/create-payment-intent`

**Request Body:**
```json
{
  "package_id": 1,
  "currency": "ils",
  "payment_method_id": "pm_1234567890",
  "save_payment_method": true
}
```

**Response:**
```json
{
  "client_secret": "pi_1234567890_secret_1234567890",
  "payment_intent_id": "pi_1234567890",
  "amount": 10000,
  "currency": "ils",
  "status": "requires_payment_method"
}
```

### Payment Confirmation

**POST** `/api/v1/payments/confirm-payment`

**Request Body:**
```json
{
  "payment_intent_id": "pi_1234567890"
}
```

**Response:**
```json
{
  "message": "Payment confirmed successfully",
  "payment_id": 123
}
```

### Payment History

**GET** `/api/v1/payments/history?page=1&per_page=10`

**Response:**
```json
{
  "payments": [
    {
      "id": 1,
      "user_id": 1,
      "amount": 100.00,
      "currency": "ILS",
      "status": "completed",
      "description": "Package purchase: 10-Class Package",
      "created_at": "2025-08-20T10:00:00Z"
    }
  ],
  "total_count": 1,
  "page": 1,
  "per_page": 10
}
```

## Payment Flow

### Package Purchase Flow

1. **User selects package** in mobile app
2. **PurchaseModal** opens with package details
3. **User selects card payment** method
4. **Navigation to PaymentScreen** with package details
5. **PaymentScreen creates payment intent** via API
6. **User enters card details** using Stripe CardField
7. **Stripe processes payment** (including 3D Secure if needed)
8. **Mobile app confirms payment** with backend
9. **Backend creates UserPackage** and updates credits
10. **User receives confirmation** and can book classes

### Webhook Processing

1. **Stripe sends webhook** to `/api/v1/webhooks/stripe`
2. **Backend verifies signature** using webhook secret
3. **Event handler processes** specific event type
4. **Database updated** with payment status
5. **Additional actions** (emails, credits, etc.)

### Subscription Flow

1. **User creates subscription** via API
2. **Stripe creates customer** and subscription
3. **Payment intent returned** for first payment
4. **User completes payment** on mobile
5. **Webhook confirms** subscription activation
6. **User granted unlimited access** for billing period

## Testing

### Test Cards

Use Stripe test cards for different scenarios:

```javascript
// Successful payment
'4242424242424242'

// Requires 3D Secure authentication
'4000002500003155'

// Declined card
'4000000000000002'

// Insufficient funds
'4000000000009995'
```

### Test Flow

1. **Install dependencies**:
```bash
# Backend
cd backend && pip install -r requirements.txt

# Mobile
cd mobile && npm install
```

2. **Run database migration**:
```bash
cd backend
python -m alembic upgrade head
```

3. **Configure Stripe keys** in config files

4. **Start development servers**:
```bash
# Backend
cd backend && uvicorn app.main:app --reload

# Mobile
cd mobile && npm start
```

5. **Test payment scenarios** with test cards

### Webhook Testing

Use Stripe CLI for local webhook testing:
```bash
stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe
```

## Security

### Webhook Security

- **Signature verification** using Stripe webhook secret
- **Idempotency handling** for duplicate events
- **Error handling** for malformed requests

### Payment Security

- **No sensitive card data** stored on backend
- **PCI compliance** through Stripe
- **TLS encryption** for all API calls
- **Tokenized payments** using Stripe tokens

### Access Control

- **Authentication required** for all payment endpoints
- **Admin-only endpoints** for refunds and management
- **User isolation** - users can only access their own payments

## Troubleshooting

### Common Issues

#### 1. Payment Intent Creation Fails
**Symptoms:** Error creating payment intent
**Solutions:**
- Check Stripe secret key configuration
- Verify package exists and is active
- Check network connectivity to Stripe

#### 2. Webhook Events Not Processing
**Symptoms:** Payments not updating in database
**Solutions:**
- Verify webhook secret configuration
- Check webhook endpoint accessibility
- Review webhook logs in Stripe dashboard

#### 3. 3D Secure Authentication Fails
**Symptoms:** Payment requires authentication but fails
**Solutions:**
- Ensure mobile app handles authentication flow
- Check 3D Secure test cards are used correctly
- Verify authentication callback handling

#### 4. Apple/Google Pay Not Working
**Symptoms:** Payment buttons not appearing or failing
**Solutions:**
- Check device/platform support
- Verify merchant configuration in Stripe
- Test on physical device (not simulator)

### Debugging

#### Backend Debugging
```bash
# Check logs
docker-compose logs backend -f

# Connect to database
docker-compose exec postgres psql -U pilates_user -d pilates_db

# View payment records
SELECT * FROM payments ORDER BY created_at DESC;
```

#### Mobile Debugging
```bash
# Clear Metro cache
npx expo start --clear

# Check Stripe logs
# Enable logging in PaymentScreen.tsx
```

### Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| `card_declined` | Card was declined | Use different card or contact bank |
| `insufficient_funds` | Insufficient funds | Add funds to account |
| `authentication_required` | 3D Secure required | Complete authentication flow |
| `payment_intent_authentication_failure` | Authentication failed | Retry with valid authentication |

## Support and Resources

### Stripe Resources
- [Stripe Documentation](https://stripe.com/docs)
- [React Native SDK](https://github.com/stripe/stripe-react-native)
- [Webhook Events](https://stripe.com/docs/api/events)

### Internal Resources
- Backend API documentation: `/docs` endpoint
- Mobile component documentation in code comments
- Database schema: `app/models/` directory

## Production Deployment

### Pre-deployment Checklist

- [ ] Replace test keys with live keys
- [ ] Set up production webhook endpoints
- [ ] Configure proper error monitoring
- [ ] Set up backup and recovery procedures
- [ ] Test all payment flows in staging environment
- [ ] Configure rate limiting for payment endpoints
- [ ] Set up monitoring and alerting for failed payments
- [ ] Document operational procedures

### Environment Variables

Production environment should include:
```bash
STRIPE_SECRET_KEY=sk_live_your_live_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_live_key
STRIPE_WEBHOOK_SECRET=whsec_your_live_webhook_secret
```

### Monitoring

Monitor these metrics in production:
- Payment success/failure rates
- Average processing time
- Webhook delivery success rates
- Refund rates
- Subscription churn rates

---

This payment system provides a comprehensive, secure, and user-friendly payment experience for the Pilates Booking Application. For additional support or questions, refer to the code comments and Stripe documentation.