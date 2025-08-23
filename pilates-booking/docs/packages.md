# Package System

Credit-based booking system where users purchase packages to book classes.

## Quick Overview

- Users purchase packages containing credits
- 1 credit = 1 class booking
- Credits expire based on package validity
- Automatic refunds on cancellations (within policy)

## Key Components

### Database Models
- **Package**: Available packages (credits, price, validity)
- **UserPackage**: User's purchased packages with remaining credits  
- **Transaction**: Complete audit trail of credit movements
- **Payment**: Financial transaction records

### Core Logic
- **FEFO (First Expiring First)**: Credits from expiring packages used first
- **Auto-expiration**: Daily background task at 2 AM
- **Refund policy**: Credits refunded if cancelled within allowed window

## API Endpoints

```bash
GET /api/v1/packages/                    # Available packages
POST /api/v1/packages/purchase           # Purchase package
GET /api/v1/packages/my-packages         # User's packages
GET /api/v1/packages/credit-balance      # Current balance
GET /api/v1/packages/transaction-summary # Transaction history
```

## Configuration

```env
# Business rules
MAX_BOOKINGS_PER_WEEK=5
CANCELLATION_HOURS_LIMIT=2
PACKAGE_EXPIRATION_HOUR=2

# Features
ENABLE_BACKGROUND_TASKS=true
WAITLIST_AUTO_PROMOTION=true
```

## Testing

Run package system tests:
```bash
python test_credit_system.py
```

## Common Issues

- **Credits not updating**: Check payment status and transaction log
- **Background tasks failing**: Verify `ENABLE_BACKGROUND_TASKS=true`
- **Mobile showing old data**: Check React Query cache invalidation