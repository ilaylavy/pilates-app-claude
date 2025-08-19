# Package and Credit Management System

This document describes the complete package and credit management system implemented for the Pilates Booking application.

## Overview

The system provides a comprehensive credit-based booking mechanism where users purchase packages containing credits, use credits to book classes, and receive refunds when cancelling classes within the allowed time window.

## System Components

### Backend Components

#### 1. Database Models

**Package** (`app/models/package.py`)
- Defines available packages with credit amounts, prices, and validity periods
- Supports both limited and unlimited packages
- Tracks active/inactive status

**UserPackage** (`app/models/package.py`)
- Links users to purchased packages
- Tracks remaining credits and expiration dates
- Provides helper methods for credit management

**Payment** (`app/models/payment.py`)
- Records all financial transactions
- Supports multiple payment methods and types
- Tracks payment status and external references

**Transaction** (`app/models/transaction.py`)
- Detailed audit trail of all credit movements
- Records credit purchases, deductions, refunds, and expirations
- Supports transaction reversal for audit purposes

#### 2. Services

**CreditService** (`app/services/credit_service.py`)
- Core business logic for credit management
- Handles credit balance calculations
- Manages credit deductions and refunds with proper prioritization
- Processes package expirations

**BookingService** (`app/services/booking_service.py`)
- Updated to integrate with credit system
- Automatically deducts credits on booking
- Refunds credits on cancellation (when policy allows)

**BackgroundTaskService** (`app/services/background_tasks.py`)
- Automated package expiration processing
- Runs daily at 2 AM to expire packages
- Creates audit transactions for expired credits

#### 3. API Endpoints

**Package Management**
- `GET /api/v1/packages/` - List available packages
- `POST /api/v1/packages/purchase` - Purchase a package
- `GET /api/v1/packages/my-packages` - User's package history
- `GET /api/v1/packages/my-packages/active` - User's active packages
- `GET /api/v1/packages/credit-balance` - Current credit balance
- `GET /api/v1/packages/transaction-summary` - Transaction history

**Admin Endpoints**
- `GET /api/v1/packages/admin/revenue-report` - Revenue analytics
- `POST /api/v1/packages/admin/expire-packages` - Manual package expiration

### Mobile Components

#### 1. Enhanced PackagesScreen

**Features:**
- **Available Packages Tab**: Browse and purchase packages
- **My Packages Tab**: View purchased packages with expiration warnings
- **Transaction History Tab**: Complete transaction audit trail
- **Credit Balance Display**: Real-time credit balance with statistics

**Key Components:**
- Package purchase with confirmation dialogs
- Expiration warnings (7 days, 30 days)
- Transaction type visualization
- Refresh functionality for real-time updates

#### 2. Updated ClassDetailsScreen

**Credit Integration:**
- Displays credit cost (1 credit per class)
- Shows user's current balance
- Prevents booking with insufficient credits
- Direct link to package purchase when needed
- Booking confirmation with credit deduction preview

#### 3. Enhanced API Client

**Updated APIs:**
- Extended packages API with new endpoints
- Proper TypeScript types for all responses
- Error handling for insufficient credits
- Automatic token refresh support

## Business Logic

### Credit Prioritization

The system uses "First Expiring First" (FEFO) logic:
1. When booking classes, credits are deducted from the package expiring soonest
2. This maximizes credit utilization and minimizes waste
3. Unlimited packages are used only when no limited packages are available

### Package Expiration

**Automatic Expiration:**
- Background task runs daily at 2 AM
- Identifies packages past their expiry date
- Creates expiration transactions for remaining credits
- Deactivates expired packages

**Manual Expiration:**
- Admin endpoint for immediate expiration processing
- Useful for testing or manual adjustments

### Payment Processing

**Mock Payment Flow:**
1. Create payment record with PENDING status
2. Process payment (currently mocked)
3. Update status to COMPLETED on success
4. Create user package and transaction records
5. All operations are transactional (rollback on failure)

### Credit Refunds

**Refund Policy:**
- Credits are refunded when bookings are cancelled within the allowed window
- Refunds are not issued for expired packages
- Refund transactions create audit trail
- Original deduction transactions are marked as reversed

## API Response Examples

### Package Purchase
```json
{
  "success": true,
  "message": "Package purchased successfully",
  "user_package": {
    "id": 1,
    "credits_remaining": 10,
    "expiry_date": "2024-09-18T00:00:00Z",
    "package": {
      "id": 1,
      "name": "Basic Package",
      "credits": 10,
      "price": 150.00
    }
  },
  "payment": {
    "id": 1,
    "amount": 150.00,
    "status": "completed"
  },
  "credits_added": 10
}
```

### Credit Balance
```json
{
  "user_id": 1,
  "credit_balance": 8,
  "timestamp": "2024-08-18T10:30:00Z"
}
```

### Transaction Summary
```json
{
  "total_credits_purchased": 20,
  "total_credits_used": 12,
  "total_credits_refunded": 2,
  "current_balance": 8,
  "recent_transactions": [
    {
      "id": 1,
      "transaction_type": "credit_purchase",
      "credit_amount": 10,
      "balance_after": 10,
      "description": "Credits purchased via package purchase",
      "created_at": "2024-08-18T09:00:00Z"
    }
  ]
}
```

## Error Handling

### Common Error Scenarios

**Insufficient Credits:**
- Status: 400 Bad Request
- Message: "Insufficient credits. Need 1, have 0"
- Mobile: Shows purchase package dialog

**Package Not Found:**
- Status: 404 Not Found
- Message: "Package not found"

**Expired Package:**
- Status: 400 Bad Request
- Message: "Package is expired or has no remaining credits"

**Payment Failure:**
- Status: 500 Internal Server Error
- Message: "Failed to process package purchase: [details]"
- All database operations are rolled back

## Testing

### Automated Test Suite

Run the complete test suite:
```bash
python test_credit_system.py
```

**Test Coverage:**
- Package purchase flow
- Credit balance calculations
- Booking with credit deduction
- Cancellation with credit refund
- Transaction history accuracy
- Package expiration handling

### Manual Testing Checklist

1. **Package Purchase:**
   - [ ] Browse available packages
   - [ ] Purchase package with mock payment
   - [ ] Verify credit balance increases
   - [ ] Check transaction history

2. **Class Booking:**
   - [ ] Book class with sufficient credits
   - [ ] Verify credit deduction
   - [ ] Check booking appears in "My Bookings"
   - [ ] Verify transaction recorded

3. **Booking Cancellation:**
   - [ ] Cancel recent booking
   - [ ] Verify credit refund
   - [ ] Check refund transaction recorded
   - [ ] Verify booking status updated

4. **Package Expiration:**
   - [ ] Create package with short expiry
   - [ ] Wait for or trigger expiration
   - [ ] Verify expired package is deactivated
   - [ ] Check expiration transaction created

5. **Edge Cases:**
   - [ ] Attempt booking with 0 credits
   - [ ] Try to refund to expired package
   - [ ] Purchase multiple packages
   - [ ] Cancel and rebook same class

## Configuration

### Environment Variables

```bash
# Database settings
DATABASE_URL=postgresql+asyncpg://username:password@localhost/pilates_db

# Business rules
MAX_BOOKINGS_PER_WEEK=5
CANCELLATION_HOURS_LIMIT=2
WAITLIST_AUTO_PROMOTION=true

# Background tasks
ENABLE_BACKGROUND_TASKS=true
PACKAGE_EXPIRATION_HOUR=2  # 2 AM
```

### Package Configuration

Create packages via admin endpoints or database seeding:

```python
# Example package data
packages = [
    {
        "name": "Basic Package",
        "description": "Perfect for beginners",
        "credits": 5,
        "price": 100.00,
        "validity_days": 30,
        "is_unlimited": False
    },
    {
        "name": "Premium Package",
        "description": "For regular practitioners",
        "credits": 10,
        "price": 180.00,
        "validity_days": 60,
        "is_unlimited": False
    },
    {
        "name": "Unlimited Monthly",
        "description": "Unlimited classes for 30 days",
        "credits": 0,
        "price": 250.00,
        "validity_days": 30,
        "is_unlimited": True
    }
]
```

## Security Considerations

### Authentication & Authorization
- All endpoints require valid JWT tokens
- Admin endpoints restricted to admin users
- Users can only access their own packages and transactions

### Data Protection
- Payment information is properly encrypted
- External payment IDs are masked in logs
- Sensitive financial data has restricted access

### Audit Trail
- All credit movements are recorded in transactions table
- Transaction reversals are logged but not deleted
- Complete audit trail for financial reconciliation

## Performance Considerations

### Database Optimization
- Indexes on frequently queried fields (user_id, expiry_date, status)
- Efficient queries with proper joins and filtering
- Background task optimization to minimize database load

### Caching Strategy
- Credit balance calculations could be cached (with invalidation)
- Package list caching for better mobile performance
- Transaction summary caching for heavy users

### Scaling Considerations
- Background tasks should be run on separate workers in production
- Payment processing should use proper queuing for high volume
- Consider read replicas for reporting and analytics

## Future Enhancements

### Planned Features
1. **Real Payment Integration**: Replace mock payments with Stripe/PayPal
2. **Loyalty Programs**: Bonus credits for frequent users
3. **Package Gifting**: Allow users to purchase packages for others
4. **Advanced Analytics**: Detailed usage patterns and revenue analysis
5. **Push Notifications**: Expiration warnings and promotion alerts

### Technical Improvements
1. **Caching Layer**: Redis for improved performance
2. **Event Sourcing**: More sophisticated audit trail
3. **Webhooks**: Real-time notifications for external integrations
4. **API Rate Limiting**: Prevent abuse of purchase endpoints
5. **Automated Testing**: Comprehensive integration test suite

## Troubleshooting

### Common Issues

**Credits not updating after purchase:**
- Check payment status in database
- Verify transaction was created
- Look for rollback in application logs

**Background tasks not running:**
- Check `ENABLE_BACKGROUND_TASKS` environment variable
- Verify no exceptions in background task logs
- Confirm database connectivity

**Mobile app showing old data:**
- Implement proper cache invalidation
- Check React Query configuration
- Verify API endpoints are being called

### Debug Endpoints

For debugging purposes (development only):

```bash
# Get detailed user package information
GET /api/v1/debug/user/{user_id}/packages

# View all transactions for user
GET /api/v1/debug/user/{user_id}/transactions

# Check background task status
GET /api/v1/debug/background-tasks/status
```

## Support

For technical support or questions about the package system implementation:

1. Check the application logs for error details
2. Run the automated test suite to verify system health
3. Review this documentation for configuration options
4. Check the database for data consistency issues

Remember to never expose sensitive payment information in logs or debug outputs.