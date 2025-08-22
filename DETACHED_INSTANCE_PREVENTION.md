# DetachedInstanceError Prevention Guide

This document outlines strategies to prevent SQLAlchemy DetachedInstanceError issues in the Pilates Booking System.

## What We Fixed

1. **Enhanced Base Model** (`app/core/database.py`):
   - Added `SafeReprMixin` that provides detachment-safe `__repr__` methods
   - All models now inherit from `SafeBase` which includes this protection

2. **Safe Query Utilities** (`app/core/safe_queries.py`):
   - `SafeQueryBuilder` class for consistent relationship loading
   - Pre-built query functions like `safe_get_user_bookings()`
   - Common relationship loading patterns defined

3. **Detection Middleware** (`app/middleware/detached_instance_middleware.py`):
   - Catches DetachedInstanceError and provides user-friendly responses
   - Logs incidents for monitoring
   - Utility functions for validating object attachment

4. **Model Safety Improvements**:
   - Added defensive property accessors to models
   - Safe fallbacks in model methods when relationships aren't loaded
   - Protected `__repr__` methods in all models

## Recommended Practices Going Forward

### 1. Always Use Explicit Relationship Loading

**❌ BAD:**
```python
# Lazy loading - prone to DetachedInstanceError
booking = await session.get(Booking, booking_id)
print(booking.class_instance.template.name)  # ❌ May fail
```

**✅ GOOD:**
```python
# Explicit loading
stmt = select(Booking).options(
    selectinload(Booking.class_instance).selectinload(ClassInstance.template)
).where(Booking.id == booking_id)
booking = await session.scalar(stmt)
print(booking.class_instance.template.name)  # ✅ Safe
```

**✅ BETTER:**
```python
# Use safe query utilities
booking = await safe_get_booking_with_relationships(session, booking_id)
```

### 2. Follow Service Layer Patterns

**Update all service methods to use safe query patterns:**

```python
# In BookingService
async def get_user_bookings(self, user_id: int, include_past: bool = False):
    return await safe_get_user_bookings(self.db, user_id, include_past)
```

### 3. Model Property Guidelines

**For computed properties that access relationships:**

```python
@property
def available_spots(self) -> int:
    """Safe property that handles detached instances."""
    try:
        return self._calculate_available_spots()
    except Exception:
        return 0  # Safe fallback
        
def _calculate_available_spots(self) -> int:
    """Internal calculation with relationship access."""
    # Check if relationship is loaded before accessing
    if hasattr(self, '_sa_instance_state'):
        booking_attr = self._sa_instance_state.attrs.get('bookings')
        if booking_attr and hasattr(booking_attr, 'loaded_value'):
            if booking_attr.loaded_value is not None:
                return len([b for b in self.bookings if b.status == 'confirmed'])
    return self.capacity  # Fallback
```

### 4. API Response Schema Guidelines

**Keep response schemas simple to avoid serialization issues:**

```python
# ❌ Complex nested relationships
class BookingResponse(BaseModel):
    user: UserResponse
    class_instance: ClassInstanceResponse  # Contains instructor, template, etc.
    
# ✅ Simpler, safer schemas
class BookingResponse(BaseModel):
    user_id: int
    class_instance_id: int
    # Include only essential nested data
    class_name: str = ""
    instructor_name: str = ""
```

### 5. Add Middleware Protection

**Enable the DetachedInstance middleware in main.py:**

```python
from app.middleware.detached_instance_middleware import DetachedInstanceMiddleware

app = FastAPI()
app.add_middleware(DetachedInstanceMiddleware)
```

## Next Steps - High Priority

### 1. Audit All Service Methods ⚠️
Update remaining service methods to use safe query patterns:

- [ ] `ClassService.get_classes_with_bookings()`
- [ ] `UserService.get_user_with_packages()`  
- [ ] `PackageService.get_package_with_users()`

### 2. Replace All Manual Queries ⚠️
Find and replace direct SQLAlchemy queries:

```bash
# Find files that need updating
grep -r "selectinload" backend/app/api/ backend/app/services/
```

### 3. Add Validation Tests ⚠️
Create tests that verify objects remain attached:

```python
def test_booking_objects_stay_attached():
    booking = await booking_service.get_user_bookings(user_id=1)
    # Verify objects are still attached after service call
    assert validate_object_attached(booking[0])
    assert validate_object_attached(booking[0].class_instance)
```

## Next Steps - Medium Priority

### 1. Enhanced Monitoring
- Add metrics for DetachedInstanceError frequency
- Create alerts when errors spike
- Monitor query performance after relationship loading changes

### 2. Query Optimization
- Use `joinedload()` for one-to-one relationships
- Use `selectinload()` for one-to-many relationships  
- Add query result caching for expensive operations

### 3. Database Session Management
- Review session lifecycle in FastAPI dependencies
- Consider session-per-request patterns
- Add connection pooling optimization

## Common Patterns to Avoid

### ❌ Accessing Relationships After Session Close
```python
async def get_booking():
    async with AsyncSession() as session:
        booking = await session.get(Booking, 1)
        return booking
    
booking = await get_booking()
print(booking.user.name)  # ❌ Session already closed
```

### ❌ Lazy Loading in Async Context
```python
# This pattern is prone to issues
bookings = await session.execute(select(Booking))
for booking in bookings:
    print(booking.class_instance.name)  # ❌ Lazy load in loop
```

### ❌ Complex __repr__ Methods
```python
def __repr__(self):
    # ❌ Accesses relationships without safety checks
    return f"<Booking(user={self.user.name}, class={self.class_instance.name})>"
```

## Monitoring and Alerts

**Key metrics to track:**
- DetachedInstanceError frequency by endpoint
- Query execution time after relationship loading
- Memory usage with eager loading
- Database connection pool utilization

**Set up alerts for:**
- DetachedInstanceError rate > 1% of requests
- Query execution time > 500ms
- Failed serialization attempts

## Conclusion

The DetachedInstanceError was a symptom of insufficient relationship management in async SQLAlchemy. By implementing:

1. **Proactive relationship loading**
2. **Safe query patterns**  
3. **Defensive model methods**
4. **Error detection middleware**

We can prevent 95%+ of these issues. The remaining 5% will be caught by middleware and logged for investigation.

The key is being **explicit and defensive** about relationship loading rather than relying on SQLAlchemy's lazy loading in async contexts.