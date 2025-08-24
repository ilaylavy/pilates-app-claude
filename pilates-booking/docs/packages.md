# Package System

**Simplified** credit-based booking system where users purchase packages and can use credits immediately.

## Quick Overview

- Users purchase packages containing credits
- **Credits are immediately available** for booking (even for cash purchases)
- 1 credit = 1 class booking  
- Credits expire based on package validity
- **Simple one-step admin payment confirmation** for cash purchases
- Automatic refunds on cancellations (within policy)

## Key Components

### Database Models
- **Package**: Available packages (credits, price, validity)
- **UserPackage**: User's purchased packages with remaining credits  
- **Transaction**: Complete audit trail of credit movements
- **Payment**: Financial transaction records

### Core Business Logic
- **FEFO (First Expiring First)**: Credits from expiring packages used first
- **Auto-expiration**: Daily background task expires old packages
- **Immediate credit availability**: No waiting for admin approval
- **Simple payment confirmation**: Admin confirms cash payments in one step

## Purchase Flow

### **Cash Purchase (Simplified)**
```
Student purchases → Package ACTIVE → Credits immediately available → Admin confirms payment later
```

### **Credit Card Purchase**
```  
Student pays via Stripe → Package ACTIVE → Credits immediately available
```

## Package States

### **UserPackageStatus**
- `ACTIVE` - Package is active and credits can be used
- `EXPIRED` - Package has passed expiry date
- `CANCELLED` - Package was cancelled by admin

### **PaymentStatus**
- `PENDING` - Cash payment not yet confirmed by admin
- `CONFIRMED` - Payment received and confirmed  
- `REJECTED` - Payment was rejected/refunded

## API Endpoints

```bash
# Public endpoints
GET /api/v1/packages/                    # Available packages
POST /api/v1/packages/purchase           # Purchase package (cash/card)
GET /api/v1/packages/my-packages         # User's packages

# Admin endpoints  
GET /api/v1/admin/packages/pending-approvals    # Cash payments pending confirmation
POST /api/v1/admin/packages/{id}/confirm-payment # Confirm cash payment
POST /api/v1/admin/packages/{id}/reject          # Reject payment
```

## Cash Purchase Integration

### **Mobile App Flow**
1. User selects cash payment option
2. Package created immediately as ACTIVE
3. User can book classes right away
4. Admin receives notification of pending payment
5. Admin confirms payment when received

### **Admin Confirmation**
```json
POST /api/v1/admin/packages/{id}/confirm-payment
{
  "payment_reference": "CASH-123-456",
  "admin_notes": "Payment received in full"
}
```

## Database Schema

### **UserPackage Model (Simplified)**
```python
class UserPackage:
    # Core fields
    user_id: int
    package_id: int
    credits_remaining: int
    purchase_date: datetime
    expiry_date: datetime
    
    # Simple status fields
    status: UserPackageStatus          # active | expired | cancelled
    payment_status: PaymentStatus      # pending | confirmed | rejected
    payment_method: PaymentMethod      # cash | credit_card | stripe
    
    # Admin fields
    approved_by: int | None
    approved_at: datetime | None
    payment_reference: str | None
    admin_notes: str | None
```

## Configuration

```env
# Business rules
MAX_BOOKINGS_PER_WEEK=5
CANCELLATION_HOURS_LIMIT=2

# Background tasks
ENABLE_BACKGROUND_TASKS=true
WAITLIST_AUTO_PROMOTION=true
```

## Credit Usage Logic

### **FEFO Implementation**
Credits are automatically used from packages expiring first:

```python
# Get packages ordered by expiry date
packages = user.packages.filter(
    is_active=True,
    status=ACTIVE,
    expiry_date > now(),
    credits_remaining > 0
).order_by('expiry_date')

# Use credit from first expiring package
package = packages.first()
package.use_credit()
```

### **Refund Logic**
```python
# Refund credit to original package if within policy
if cancellation_within_policy:
    original_package.refund_credit()
```

## Admin Dashboard

### **Pending Payments View**
- Shows all cash purchases awaiting confirmation
- One-click confirmation with payment reference
- Rejection with reason tracking
- Real-time status updates

### **Package Analytics**
- Credit usage patterns
- Popular package types
- Payment method distribution
- Expiration tracking

## Mobile App Features

### **Immediate Booking**
- Credits available right after cash purchase
- No waiting for admin approval
- Real-time package status updates

### **Payment Tracking**
- Clear indication of payment status
- Instructions for cash payment
- Reference codes for easy admin lookup

## Testing

### **Unit Tests**
```bash
# Test simplified model
python test_simplified_migration.py

# Test API integration  
python test_api_integration.py
```

### **Integration Tests**
```bash
# Full end-to-end testing
python test_package_flows.py
```

## Migration Notes

### **Migrated from Complex to Simple**
- Removed two-step approval process
- Simplified enum values (5 → 3 payment statuses)
- Removed RESERVED package status
- Credits immediately available for cash purchases

### **Data Migration**
- `pending_approval` → `pending`
- `authorized` → `pending`  
- `payment_confirmed` → `confirmed`
- `reserved` → `active`

## Common Issues & Solutions

### **Credits Not Available**
- **Check**: Package status should be `ACTIVE`
- **Check**: Payment status (can be `PENDING` or `CONFIRMED`)
- **Check**: Expiry date not passed
- **Check**: Credits remaining > 0

### **Cash Payment Not Confirmed**
- Admin needs to confirm in dashboard
- Check payment reference matches
- Verify admin has proper permissions

### **Mobile App Issues**
- Clear React Query cache if showing old data
- Check API endpoint responses
- Verify simplified enum values in frontend

## Performance Considerations

- **Indexes**: Added on `user_id`, `expiry_date`, `status`
- **FEFO queries**: Optimized with proper ordering
- **Background tasks**: Efficient bulk operations for expiry
- **Caching**: Package data cached for 5 minutes on mobile

## Security Features

- **Payment confirmation**: Only admins can confirm/reject
- **Audit trail**: All credit movements logged in transactions
- **Reference codes**: Unique identifiers for cash payments
- **Admin notes**: Track payment confirmation details

---

## 🎯 **Key Benefits of Simplified System**

✅ **For Students**: Immediate credit availability, no approval delays  
✅ **For Admins**: Simple one-step payment confirmation  
✅ **For Developers**: Reduced complexity, easier maintenance  
✅ **For Business**: Improved customer experience, faster operations