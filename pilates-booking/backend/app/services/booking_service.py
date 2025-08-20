from typing import Optional, List
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, func
from fastapi import HTTPException, status
from datetime import datetime, timedelta, timezone

from ..models.booking import Booking, BookingStatus, CancellationReason, WaitlistEntry
from ..models.class_schedule import ClassInstance
from ..models.package import UserPackage
from ..models.user import User
from ..core.config import settings


class BookingService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_booking(
        self, 
        user: User, 
        class_instance_id: int, 
        user_package_id: Optional[int] = None
    ) -> Booking:
        """Create a booking for a user."""
        
        # Get class instance
        stmt = select(ClassInstance).where(ClassInstance.id == class_instance_id)
        result = await self.db.execute(stmt)
        class_instance = result.scalar_one_or_none()
        
        if not class_instance:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Class not found"
            )
        
        # Check if class is in the future
        if class_instance.start_datetime <= datetime.now(timezone.utc):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot book past or ongoing classes"
            )
        
        # Check if user already has a booking for this class
        stmt = select(Booking).where(
            and_(
                Booking.user_id == user.id,
                Booking.class_instance_id == class_instance_id,
                Booking.status == BookingStatus.CONFIRMED
            )
        )
        result = await self.db.execute(stmt)
        existing_booking = result.scalar_one_or_none()
        
        if existing_booking:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You already have a booking for this class"
            )
        
        # Check weekly booking limit
        await self._check_weekly_booking_limit(user.id, class_instance.start_datetime)
        
        # If class has available spots, create booking
        if class_instance.available_spots > 0:
            # If user package specified, validate and use credit
            if user_package_id:
                user_package = await self._validate_and_use_package(user.id, user_package_id)
            else:
                user_package_id = None
            
            booking = Booking(
                user_id=user.id,
                class_instance_id=class_instance_id,
                user_package_id=user_package_id,
                status=BookingStatus.CONFIRMED
            )
            
            self.db.add(booking)
            await self.db.commit()
            await self.db.refresh(booking)
            
            return booking
        
        else:
            # Add to waitlist
            return await self._add_to_waitlist(user.id, class_instance_id)

    async def cancel_booking(self, booking_id: int, user: User, reason: Optional[str] = None) -> Booking:
        """Cancel a booking."""
        
        stmt = select(Booking).where(Booking.id == booking_id)
        result = await self.db.execute(stmt)
        booking = result.scalar_one_or_none()
        
        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Booking not found"
            )
        
        # Check if user owns the booking (unless admin)
        if booking.user_id != user.id and user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this booking"
            )
        
        # Check if booking can be cancelled
        if not booking.can_cancel:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking cannot be cancelled within the cancellation window"
            )
        
        # Cancel the booking
        booking.status = BookingStatus.CANCELLED
        booking.cancellation_date = datetime.now(timezone.utc)
        booking.cancellation_reason = CancellationReason.USER_CANCELLED
        booking.notes = reason
        
        # Refund credit if applicable
        if booking.user_package_id:
            await self._refund_package_credit(booking.user_package_id)
        
        await self.db.commit()
        
        # Promote from waitlist if auto-promotion is enabled
        if settings.WAITLIST_AUTO_PROMOTION:
            await self._promote_from_waitlist(booking.class_instance_id)
        
        return booking

    async def get_user_bookings(self, user_id: int, include_past: bool = False) -> List[Booking]:
        """Get all bookings for a user."""
        
        conditions = [Booking.user_id == user_id]
        
        if not include_past:
            # Only future bookings
            stmt = (
                select(Booking)
                .join(ClassInstance)
                .where(
                    and_(
                        *conditions,
                        ClassInstance.start_datetime > datetime.now(timezone.utc)
                    )
                )
                .order_by(ClassInstance.start_datetime)
            )
        else:
            stmt = (
                select(Booking)
                .join(ClassInstance)
                .where(and_(*conditions))
                .order_by(ClassInstance.start_datetime.desc())
            )
        
        result = await self.db.execute(stmt)
        bookings = result.scalars().all()
        
        return bookings

    async def _check_weekly_booking_limit(self, user_id: int, class_datetime: datetime):
        """Check if user has exceeded weekly booking limit."""
        
        week_start = class_datetime - timedelta(days=class_datetime.weekday())
        week_end = week_start + timedelta(days=7)
        
        stmt = (
            select(func.count(Booking.id))
            .join(ClassInstance)
            .where(
                and_(
                    Booking.user_id == user_id,
                    Booking.status == BookingStatus.CONFIRMED,
                    ClassInstance.start_datetime >= week_start,
                    ClassInstance.start_datetime < week_end
                )
            )
        )
        
        result = await self.db.execute(stmt)
        booking_count = result.scalar()
        
        if booking_count >= settings.MAX_BOOKINGS_PER_WEEK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Weekly booking limit of {settings.MAX_BOOKINGS_PER_WEEK} reached"
            )

    async def _validate_and_use_package(self, user_id: int, user_package_id: int) -> UserPackage:
        """Validate and use a credit from user package."""
        
        stmt = select(UserPackage).where(
            and_(
                UserPackage.id == user_package_id,
                UserPackage.user_id == user_id
            )
        )
        result = await self.db.execute(stmt)
        user_package = result.scalar_one_or_none()
        
        if not user_package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Package not found"
            )
        
        if not user_package.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Package is expired or has no remaining credits"
            )
        
        # Use credit
        if not user_package.use_credit():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to use credit from package"
            )
        
        return user_package

    async def _refund_package_credit(self, user_package_id: int):
        """Refund a credit to user package."""
        
        stmt = select(UserPackage).where(UserPackage.id == user_package_id)
        result = await self.db.execute(stmt)
        user_package = result.scalar_one_or_none()
        
        if user_package:
            user_package.refund_credit()

    async def _add_to_waitlist(self, user_id: int, class_instance_id: int) -> WaitlistEntry:
        """Add user to waitlist for a class."""
        
        # Check if user is already on waitlist
        stmt = select(WaitlistEntry).where(
            and_(
                WaitlistEntry.user_id == user_id,
                WaitlistEntry.class_instance_id == class_instance_id,
                WaitlistEntry.is_active == True
            )
        )
        result = await self.db.execute(stmt)
        existing_entry = result.scalar_one_or_none()
        
        if existing_entry:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are already on the waitlist for this class"
            )
        
        # Get next position
        stmt = (
            select(func.max(WaitlistEntry.position))
            .where(
                and_(
                    WaitlistEntry.class_instance_id == class_instance_id,
                    WaitlistEntry.is_active == True
                )
            )
        )
        result = await self.db.execute(stmt)
        max_position = result.scalar() or 0
        
        waitlist_entry = WaitlistEntry(
            user_id=user_id,
            class_instance_id=class_instance_id,
            position=max_position + 1
        )
        
        self.db.add(waitlist_entry)
        await self.db.commit()
        await self.db.refresh(waitlist_entry)
        
        return waitlist_entry

    async def _promote_from_waitlist(self, class_instance_id: int):
        """Promote the next person from waitlist when a spot opens."""
        
        # Get next person on waitlist
        stmt = (
            select(WaitlistEntry)
            .where(
                and_(
                    WaitlistEntry.class_instance_id == class_instance_id,
                    WaitlistEntry.is_active == True
                )
            )
            .order_by(WaitlistEntry.position)
            .limit(1)
        )
        
        result = await self.db.execute(stmt)
        next_entry = result.scalar_one_or_none()
        
        if next_entry:
            # Create booking for waitlisted user
            booking = Booking(
                user_id=next_entry.user_id,
                class_instance_id=class_instance_id,
                status=BookingStatus.CONFIRMED
            )
            
            # Mark waitlist entry as promoted
            next_entry.is_active = False
            next_entry.promoted_date = datetime.now(timezone.utc)
            
            self.db.add(booking)
            await self.db.commit()
            
            # TODO: Send notification to user about promotion