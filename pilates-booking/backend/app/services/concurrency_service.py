"""
Service for handling concurrency and race conditions in booking operations.
Implements both pessimistic locking (SELECT FOR UPDATE) and optimistic locking (version numbers).
"""
import asyncio
import random
from typing import Optional, Any, Callable, TypeVar, Awaitable
from datetime import datetime, timezone

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.exc import StaleDataError
from sqlalchemy.exc import IntegrityError

from ..models.booking import Booking, BookingStatus
from ..models.class_schedule import ClassInstance, ClassStatus
from ..models.package import UserPackage
from ..core.cache import cache, invalidate_user_cache, invalidate_class_cache

T = TypeVar("T")


class ConcurrencyError(Exception):
    """Base exception for concurrency-related errors."""
    pass


class OptimisticLockError(ConcurrencyError):
    """Raised when optimistic locking fails due to version conflicts."""
    pass


class PessimisticLockError(ConcurrencyError):
    """Raised when pessimistic locking fails (timeout or deadlock)."""
    pass


class BookingRaceConditionHandler:
    """Handles race conditions in booking operations using multiple strategies."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def create_booking_atomic(
        self,
        user_id: int,
        class_instance_id: int,
        user_package_id: Optional[int] = None,
        max_retries: int = 3
    ) -> tuple[Booking, bool]:  # (booking, success)
        """
        Create a booking with atomic capacity checking using pessimistic locking.
        
        Returns:
            tuple: (booking_object_or_none, success_boolean)
        """
        for attempt in range(max_retries):
            try:
                # Start a new transaction for each attempt
                await self.session.begin()
                
                # Lock the class instance for update to prevent race conditions
                class_stmt = (
                    select(ClassInstance)
                    .options(
                        selectinload(ClassInstance.template),
                        selectinload(ClassInstance.bookings)
                    )
                    .where(ClassInstance.id == class_instance_id)
                    .with_for_update()  # Pessimistic lock
                )
                
                result = await self.session.execute(class_stmt)
                class_instance = result.scalar_one_or_none()
                
                if not class_instance:
                    await self.session.rollback()
                    return None, False
                
                # Check class status
                if class_instance.status != ClassStatus.SCHEDULED:
                    await self.session.rollback()
                    return None, False
                
                # Check capacity atomically
                confirmed_bookings = [
                    b for b in class_instance.bookings 
                    if b.status == BookingStatus.CONFIRMED
                ]
                
                if len(confirmed_bookings) >= class_instance.capacity:
                    await self.session.rollback()
                    return None, False  # Class is full
                
                # Check if user already has a booking for this class
                existing_booking = next(
                    (b for b in confirmed_bookings if b.user_id == user_id), 
                    None
                )
                if existing_booking:
                    await self.session.rollback()
                    return None, False  # User already booked
                
                # If user_package provided, lock and validate it
                user_package = None
                if user_package_id:
                    package_stmt = (
                        select(UserPackage)
                        .where(UserPackage.id == user_package_id)
                        .where(UserPackage.user_id == user_id)
                        .with_for_update()
                    )
                    
                    result = await self.session.execute(package_stmt)
                    user_package = result.scalar_one_or_none()
                    
                    if not user_package or not user_package.is_valid or user_package.credits_remaining <= 0:
                        await self.session.rollback()
                        return None, False
                
                # Create the booking
                booking = Booking(
                    user_id=user_id,
                    class_instance_id=class_instance_id,
                    user_package_id=user_package_id,
                    status=BookingStatus.CONFIRMED,
                    booking_date=datetime.now(timezone.utc)
                )
                
                self.session.add(booking)
                
                # Consume credit if package is used
                if user_package:
                    user_package.use_credit()
                
                # Increment version for optimistic locking
                class_instance.version += 1
                
                await self.session.commit()
                
                # Invalidate relevant caches
                await invalidate_user_cache(user_id)
                await invalidate_class_cache(class_instance_id)
                
                return booking, True
                
            except IntegrityError as e:
                await self.session.rollback()
                if attempt < max_retries - 1:
                    # Exponential backoff with jitter
                    await asyncio.sleep(0.1 * (2 ** attempt) + random.random() * 0.1)
                    continue
                else:
                    raise ConcurrencyError(f"Failed to create booking after {max_retries} attempts") from e
                    
            except Exception as e:
                await self.session.rollback()
                raise ConcurrencyError(f"Unexpected error during booking creation: {str(e)}") from e
        
        return None, False
    
    async def cancel_booking_atomic(
        self,
        booking_id: int,
        cancellation_reason: str,
        max_retries: int = 3
    ) -> tuple[Booking, bool]:
        """Cancel a booking atomically with optimistic locking."""
        for attempt in range(max_retries):
            try:
                await self.session.begin()
                
                # Load booking with lock and current version
                booking_stmt = (
                    select(Booking)
                    .options(
                        selectinload(Booking.class_instance),
                        selectinload(Booking.user_package)
                    )
                    .where(Booking.id == booking_id)
                    .with_for_update()
                )
                
                result = await self.session.execute(booking_stmt)
                booking = result.scalar_one_or_none()
                
                if not booking or booking.status != BookingStatus.CONFIRMED:
                    await self.session.rollback()
                    return None, False
                
                # Check if cancellation is allowed (business logic)
                if not booking.can_cancel:
                    await self.session.rollback()
                    return None, False
                
                # Update booking status with version check
                original_version = booking.version
                booking.status = BookingStatus.CANCELLED
                booking.cancellation_date = datetime.now(timezone.utc)
                booking.cancellation_reason = cancellation_reason
                booking.version = original_version + 1
                
                # Refund credit if applicable
                if booking.user_package:
                    booking.user_package.refund_credit()
                
                await self.session.commit()
                
                # Invalidate caches
                await invalidate_user_cache(booking.user_id)
                await invalidate_class_cache(booking.class_instance_id)
                
                return booking, True
                
            except StaleDataError:
                await self.session.rollback()
                if attempt < max_retries - 1:
                    await asyncio.sleep(0.1 * (2 ** attempt) + random.random() * 0.1)
                    continue
                else:
                    raise OptimisticLockError(f"Booking {booking_id} was modified by another transaction")
                    
            except Exception as e:
                await self.session.rollback()
                raise ConcurrencyError(f"Unexpected error during booking cancellation: {str(e)}") from e
        
        return None, False


async def with_retry_and_backoff(
    func: Callable[..., Awaitable[T]],
    max_retries: int = 3,
    base_delay: float = 0.1,
    max_delay: float = 5.0,
    backoff_factor: float = 2.0,
    *args,
    **kwargs
) -> T:
    """
    Execute a function with exponential backoff retry logic.
    
    Args:
        func: Async function to execute
        max_retries: Maximum number of retry attempts
        base_delay: Initial delay in seconds
        max_delay: Maximum delay in seconds
        backoff_factor: Multiplier for exponential backoff
        *args, **kwargs: Arguments to pass to func
    
    Raises:
        The last exception if all retries fail
    """
    last_exception = None
    
    for attempt in range(max_retries + 1):
        try:
            return await func(*args, **kwargs)
        except (ConcurrencyError, IntegrityError, StaleDataError) as e:
            last_exception = e
            
            if attempt < max_retries:
                # Calculate delay with jitter
                delay = min(
                    base_delay * (backoff_factor ** attempt),
                    max_delay
                )
                jitter = random.random() * 0.1 * delay
                total_delay = delay + jitter
                
                print(f"Retry attempt {attempt + 1}/{max_retries} after {total_delay:.2f}s delay")
                await asyncio.sleep(total_delay)
            else:
                print(f"All {max_retries} retry attempts failed")
    
    # Re-raise the last exception
    raise last_exception


class OptimisticLockingService:
    """Service for handling optimistic locking operations."""
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def update_with_version_check(
        self,
        model_class,
        record_id: int,
        updates: dict,
        expected_version: int
    ) -> bool:
        """
        Update a record with optimistic locking version check.
        
        Args:
            model_class: SQLAlchemy model class
            record_id: ID of the record to update
            updates: Dictionary of fields to update
            expected_version: Expected current version
        
        Returns:
            bool: True if update succeeded, False if version conflict
        """
        try:
            # Add version increment to updates
            updates_with_version = {**updates, "version": expected_version + 1}
            
            stmt = (
                update(model_class)
                .where(model_class.id == record_id)
                .where(model_class.version == expected_version)
                .values(**updates_with_version)
            )
            
            result = await self.session.execute(stmt)
            
            if result.rowcount == 0:
                # No rows updated - version conflict
                return False
            
            await self.session.commit()
            return True
            
        except Exception as e:
            await self.session.rollback()
            raise ConcurrencyError(f"Error during optimistic update: {str(e)}") from e


# Example usage patterns
async def safe_booking_creation(
    session: AsyncSession,
    user_id: int,
    class_instance_id: int,
    user_package_id: Optional[int] = None
) -> tuple[Optional[Booking], bool]:
    """Safe booking creation with race condition handling."""
    handler = BookingRaceConditionHandler(session)
    
    return await with_retry_and_backoff(
        handler.create_booking_atomic,
        max_retries=3,
        user_id=user_id,
        class_instance_id=class_instance_id,
        user_package_id=user_package_id
    )


async def safe_booking_cancellation(
    session: AsyncSession,
    booking_id: int,
    cancellation_reason: str
) -> tuple[Optional[Booking], bool]:
    """Safe booking cancellation with race condition handling."""
    handler = BookingRaceConditionHandler(session)
    
    return await with_retry_and_backoff(
        handler.cancel_booking_atomic,
        max_retries=3,
        booking_id=booking_id,
        cancellation_reason=cancellation_reason
    )