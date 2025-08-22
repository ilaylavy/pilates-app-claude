from datetime import datetime, timedelta, timezone
from typing import List, Optional

from fastapi import HTTPException, status
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import settings
from ..core.logging_config import get_logger
from ..core.safe_queries import safe_get_user_bookings, safe_get_booking_with_relationships
from ..models.booking import (Booking, BookingStatus, CancellationReason,
                              WaitlistEntry)
from ..models.class_schedule import ClassInstance
from ..models.package import UserPackage
from ..models.user import User
from ..services.business_logging_service import business_logger


class BookingService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.logger = get_logger("app.booking")

    async def create_booking(
        self, user: User, class_instance_id: int, user_package_id: Optional[int] = None
    ) -> Booking:
        """Create a booking for a user."""

        try:
            self.logger.info(
                "Booking creation attempt",
                user_id=str(user.id),
                email=user.email,
                class_id=class_instance_id,
                package_id=user_package_id,
            )

            # Get class instance with bookings loaded
            from sqlalchemy.orm import selectinload

            stmt = (
                select(ClassInstance)
                .options(
                    selectinload(ClassInstance.bookings),
                    selectinload(ClassInstance.template)
                )
                .where(ClassInstance.id == class_instance_id)
            )
            result = await self.db.execute(stmt)
            class_instance = result.scalar_one_or_none()

            if not class_instance:
                self.logger.warning(
                    "Booking failed - class not found",
                    class_id=class_instance_id,
                    user_id=str(user.id),
                )
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="Class not found"
                )

            # Check if class is in the future
            if class_instance.start_datetime <= datetime.now(timezone.utc):
                self.logger.warning(
                    "Booking failed - class is in the past",
                    class_id=class_instance_id,
                    user_id=str(user.id),
                    class_start_time=class_instance.start_datetime,
                )
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Cannot book past or ongoing classes",
                )

            # Check if user already has a booking for this class
            stmt = select(Booking).where(
                and_(
                    Booking.user_id == user.id,
                    Booking.class_instance_id == class_instance_id,
                    Booking.status == BookingStatus.CONFIRMED,
                )
            )
            result = await self.db.execute(stmt)
            existing_booking = result.scalar_one_or_none()

            if existing_booking:
                self.logger.info(
                    "User already has booking for this class - returning existing booking",
                    class_id=class_instance_id,
                    user_id=str(user.id),
                    existing_booking_id=str(existing_booking.id),
                )
                
                # Reload existing booking with all relationships to avoid DetachedInstanceError
                from sqlalchemy.orm import selectinload
                
                stmt = (
                    select(Booking)
                    .options(
                        selectinload(Booking.class_instance).selectinload(ClassInstance.template),
                        selectinload(Booking.class_instance).selectinload(ClassInstance.instructor),
                        selectinload(Booking.user),
                        selectinload(Booking.user_package)
                    )
                    .where(Booking.id == existing_booking.id)
                )
                result = await self.db.execute(stmt)
                existing_booking = result.scalar_one()
                
                # Set flag to indicate this is an existing booking
                existing_booking.is_new_booking = False
                return existing_booking

            # Check weekly booking limit
            await self._check_weekly_booking_limit(
                user.id, class_instance.start_datetime
            )

            # If class has available spots, create booking
            if class_instance.get_available_spots() > 0:
                available_spots = class_instance.get_available_spots()
                self.logger.info(
                    "Class has available spots - creating confirmed booking",
                    available_spots=available_spots,
                    class_id=class_instance_id,
                    user_id=str(user.id),
                )

                # If user package specified, validate and use credit
                if user_package_id:
                    user_package = await self._validate_and_use_package(
                        user.id, user_package_id
                    )
                    self.logger.info(
                        "Using package credit for booking",
                        package_id=user_package_id,
                        credits_remaining=user_package.credits_remaining,
                        user_id=str(user.id),
                    )
                else:
                    user_package_id = None
                    self.logger.info(
                        "Booking without package (direct payment)",
                        user_id=str(user.id),
                        class_id=class_instance_id,
                    )

                booking = Booking(
                    user_id=user.id,
                    class_instance_id=class_instance_id,
                    user_package_id=user_package_id,
                    status=BookingStatus.CONFIRMED,
                )

                self.db.add(booking)
                await self.db.commit()
                await self.db.refresh(booking)

                # Reload booking with all relationships to avoid DetachedInstanceError
                from sqlalchemy.orm import selectinload
                
                stmt = (
                    select(Booking)
                    .options(
                        selectinload(Booking.class_instance).selectinload(ClassInstance.template),
                        selectinload(Booking.class_instance).selectinload(ClassInstance.instructor),
                        selectinload(Booking.user),
                        selectinload(Booking.user_package)
                    )
                    .where(Booking.id == booking.id)
                )
                result = await self.db.execute(stmt)
                booking = result.scalar_one()
                
                # Set flag to indicate this is a newly created booking
                booking.is_new_booking = True

                # Log successful booking creation
                credits_used = 1 if user_package_id else 0
                business_logger.log_booking_created(
                    user_id=str(user.id),
                    class_id=str(class_instance_id),
                    booking_id=str(booking.id),
                    credits_used=credits_used,
                    booking_method="web",
                )

                self.logger.info(
                    "Booking created successfully",
                    booking_id=str(booking.id),
                    user_id=str(user.id),
                    email=user.email,
                    class_id=class_instance_id,
                    status=BookingStatus.CONFIRMED.value,
                )

                return booking

            else:
                # Add to waitlist
                available_spots = class_instance.get_available_spots()
                self.logger.info(
                    "Class is full - adding to waitlist",
                    available_spots=available_spots,
                    class_id=class_instance_id,
                    user_id=str(user.id),
                )
                return await self._add_to_waitlist(user.id, class_instance_id)

        except HTTPException:
            raise
        except Exception as e:
            self.logger.error(
                "Booking creation failed with exception",
                exc_info=True,
                user_id=str(user.id),
                class_id=class_instance_id,
                error=str(e),
            )
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Booking creation failed",
            )

    async def cancel_booking(
        self, booking_id: int, user: User, reason: Optional[str] = None
    ) -> Booking:
        """Cancel a booking."""

        from sqlalchemy.orm import selectinload

        stmt = (
            select(Booking)
            .options(selectinload(Booking.class_instance))
            .where(Booking.id == booking_id)
        )
        result = await self.db.execute(stmt)
        booking = result.scalar_one_or_none()

        if not booking:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Booking not found"
            )

        # Check if user owns the booking (unless admin)
        if booking.user_id != user.id and user.role.value != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not authorized to cancel this booking",
            )

        # Check if booking can be cancelled
        if not booking.can_cancel:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Booking cannot be cancelled within the cancellation window",
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

        # Reload booking with relationships to avoid DetachedInstanceError
        stmt = (
            select(Booking)
            .options(
                selectinload(Booking.class_instance).selectinload(ClassInstance.template),
                selectinload(Booking.class_instance).selectinload(ClassInstance.instructor),
                selectinload(Booking.user),
                selectinload(Booking.user_package)
            )
            .where(Booking.id == booking.id)
        )
        result = await self.db.execute(stmt)
        booking = result.scalar_one()

        # Promote from waitlist if auto-promotion is enabled
        if settings.WAITLIST_AUTO_PROMOTION:
            await self._promote_from_waitlist(booking.class_instance_id)

        return booking

    async def get_user_bookings(
        self, user_id: int, include_past: bool = False
    ) -> List[Booking]:
        """Get all bookings for a user using safe query patterns."""
        return await safe_get_user_bookings(self.db, user_id, include_past)

    async def get_user_bookings_filtered(
        self,
        user_id: int,
        status: Optional[str] = None,
        upcoming: bool = False,
        limit: Optional[int] = None,
    ) -> List[Booking]:
        """Get filtered bookings for a user."""

        from sqlalchemy.orm import selectinload

        conditions = [Booking.user_id == user_id]

        # Filter by status if provided
        if status:
            try:
                booking_status = BookingStatus(status.upper())
                conditions.append(Booking.status == booking_status)
            except ValueError:
                # Invalid status, return empty list
                return []

        # Filter for upcoming bookings
        if upcoming:
            conditions.append(ClassInstance.start_datetime > datetime.now(timezone.utc))

        stmt = (
            select(Booking)
            .options(
                selectinload(Booking.class_instance).selectinload(ClassInstance.template),
                selectinload(Booking.class_instance).selectinload(ClassInstance.instructor),
                selectinload(Booking.user),
                selectinload(Booking.user_package)
            )
            .join(ClassInstance)
            .where(and_(*conditions))
            .order_by(ClassInstance.start_datetime)
        )

        if limit:
            stmt = stmt.limit(limit)

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
                    ClassInstance.start_datetime < week_end,
                )
            )
        )

        result = await self.db.execute(stmt)
        booking_count = result.scalar()

        if booking_count >= settings.MAX_BOOKINGS_PER_WEEK:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Weekly booking limit of {settings.MAX_BOOKINGS_PER_WEEK} reached",
            )

    async def _validate_and_use_package(
        self, user_id: int, user_package_id: int
    ) -> UserPackage:
        """Validate and use a credit from user package."""

        from sqlalchemy.orm import selectinload

        stmt = (
            select(UserPackage)
            .options(selectinload(UserPackage.package))
            .where(
                and_(UserPackage.id == user_package_id, UserPackage.user_id == user_id)
            )
        )
        result = await self.db.execute(stmt)
        user_package = result.scalar_one_or_none()

        if not user_package:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND, detail="Package not found"
            )

        if not user_package.is_valid:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Package is expired or has no remaining credits",
            )

        # Use credit
        if not user_package.use_credit():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to use credit from package",
            )

        return user_package

    async def _refund_package_credit(self, user_package_id: int):
        """Refund a credit to user package."""

        from sqlalchemy.orm import selectinload

        stmt = (
            select(UserPackage)
            .options(selectinload(UserPackage.package))
            .where(UserPackage.id == user_package_id)
        )
        result = await self.db.execute(stmt)
        user_package = result.scalar_one_or_none()

        if user_package:
            user_package.refund_credit()

    async def _add_to_waitlist(
        self, user_id: int, class_instance_id: int
    ) -> WaitlistEntry:
        """Add user to waitlist for a class."""

        # Check if user is already on waitlist
        stmt = select(WaitlistEntry).where(
            and_(
                WaitlistEntry.user_id == user_id,
                WaitlistEntry.class_instance_id == class_instance_id,
                WaitlistEntry.is_active == True,
            )
        )
        result = await self.db.execute(stmt)
        existing_entry = result.scalar_one_or_none()

        if existing_entry:
            self.logger.info(
                "User already on waitlist for this class - returning existing entry",
                class_id=class_instance_id,
                user_id=user_id,
                existing_entry_id=str(existing_entry.id),
            )
            
            # Set flag to indicate this is an existing waitlist entry
            existing_entry.is_new_entry = False
            return existing_entry

        # Get next position
        stmt = select(func.max(WaitlistEntry.position)).where(
            and_(
                WaitlistEntry.class_instance_id == class_instance_id,
                WaitlistEntry.is_active == True,
            )
        )
        result = await self.db.execute(stmt)
        max_position = result.scalar() or 0

        waitlist_entry = WaitlistEntry(
            user_id=user_id,
            class_instance_id=class_instance_id,
            position=max_position + 1,
        )

        self.db.add(waitlist_entry)
        await self.db.commit()
        await self.db.refresh(waitlist_entry)
        
        # Set flag to indicate this is a newly created waitlist entry
        waitlist_entry.is_new_entry = True

        return waitlist_entry

    async def _promote_from_waitlist(self, class_instance_id: int):
        """Promote the next person from waitlist when a spot opens."""

        # Get next person on waitlist
        stmt = (
            select(WaitlistEntry)
            .where(
                and_(
                    WaitlistEntry.class_instance_id == class_instance_id,
                    WaitlistEntry.is_active == True,
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
                status=BookingStatus.CONFIRMED,
            )

            # Mark waitlist entry as promoted
            next_entry.is_active = False
            next_entry.promoted_date = datetime.now(timezone.utc)

            self.db.add(booking)
            await self.db.commit()

            # TODO: Send notification to user about promotion
