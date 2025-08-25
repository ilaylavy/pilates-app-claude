"""
Business Logic Integration Tests for Booking System

Tests core business rules and logic with database integration:
1. Credit consumption and refunding logic
2. Booking limits and business rules
3. Cancellation window enforcement
4. Waitlist management and auto-promotion
5. Package expiration handling
6. Complex multi-package scenarios
"""

import pytest
from datetime import datetime, timedelta
from decimal import Decimal
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.models.package import Package
from app.models.user_package import UserPackage
from app.models.class_template import ClassTemplate, ClassLevel
from app.models.class_instance import ClassInstance
from app.models.booking import Booking, BookingStatus
from app.models.waitlist import WaitlistEntry
from app.services.booking_service import BookingService
from app.services.package_service import PackageService
from app.core.config import settings
from tests.factories import UserFactory, PackageFactory, ClassTemplateFactory, InstructorFactory


@pytest.mark.integration
class TestCreditLogic:
    """Test credit consumption and refunding business logic."""

    @pytest.fixture
    async def user_with_credits(self, db_session: AsyncSession):
        """Create a user with an active package containing credits."""
        user = UserFactory()
        package = PackageFactory(credits=10, validity_days=30)
        
        db_session.add(user)
        db_session.add(package)
        await db_session.commit()
        
        user_package = UserPackage(
            user_id=user.id,
            package_id=package.id,
            remaining_credits=10,
            expires_at=datetime.utcnow() + timedelta(days=30),
            is_active=True
        )
        db_session.add(user_package)
        await db_session.commit()
        await db_session.refresh(user_package)
        
        return user, user_package

    @pytest.fixture
    async def test_class_instance(self, db_session: AsyncSession):
        """Create a test class for booking."""
        instructor = InstructorFactory()
        template = ClassTemplateFactory(capacity=10)
        
        db_session.add(instructor)
        db_session.add(template)
        await db_session.commit()
        
        future_time = datetime.utcnow() + timedelta(hours=24)
        class_instance = ClassInstance(
            template_id=template.id,
            instructor_id=instructor.id,
            start_datetime=future_time,
            end_datetime=future_time + timedelta(minutes=60),
            capacity=10,
            is_active=True
        )
        db_session.add(class_instance)
        await db_session.commit()
        await db_session.refresh(class_instance)
        
        return class_instance

    @pytest.mark.asyncio
    async def test_credit_consumption_on_booking(self, db_session: AsyncSession, user_with_credits, test_class_instance):
        """Test that credits are properly consumed when booking a class."""
        user, user_package = user_with_credits
        booking_service = BookingService(db_session)
        
        # Initial state
        assert user_package.remaining_credits == 10
        
        # Make a booking
        booking = await booking_service.create_booking(
            user_id=user.id,
            class_instance_id=test_class_instance.id,
            user_package_id=user_package.id
        )
        
        # Verify booking created
        assert booking.status == BookingStatus.CONFIRMED
        assert booking.user_id == user.id
        assert booking.class_instance_id == test_class_instance.id
        
        # Verify credit consumed
        await db_session.refresh(user_package)
        assert user_package.remaining_credits == 9
        
        # Verify audit trail
        assert booking.credits_used == 1
        assert booking.user_package_id == user_package.id

    @pytest.mark.asyncio
    async def test_credit_refund_on_cancellation(self, db_session: AsyncSession, user_with_credits, test_class_instance):
        """Test that credits are refunded when cancelling within the allowed window."""
        user, user_package = user_with_credits
        booking_service = BookingService(db_session)
        
        # Make a booking
        booking = await booking_service.create_booking(
            user_id=user.id,
            class_instance_id=test_class_instance.id,
            user_package_id=user_package.id
        )
        
        await db_session.refresh(user_package)
        assert user_package.remaining_credits == 9
        
        # Cancel the booking (within cancellation window)
        cancelled_booking = await booking_service.cancel_booking(
            booking_id=booking.id,
            user_id=user.id
        )
        
        # Verify booking cancelled
        assert cancelled_booking.status == BookingStatus.CANCELLED
        
        # Verify credit refunded
        await db_session.refresh(user_package)
        assert user_package.remaining_credits == 10
        
        # Verify cancellation reason recorded
        assert cancelled_booking.cancellation_reason is not None

    @pytest.mark.asyncio
    async def test_no_credit_refund_outside_cancellation_window(self, db_session: AsyncSession):
        """Test that credits are not refunded when cancelling outside the allowed window."""
        user = UserFactory()
        package = PackageFactory(credits=5)
        
        db_session.add(user)
        db_session.add(package)
        await db_session.commit()
        
        user_package = UserPackage(
            user_id=user.id,
            package_id=package.id,
            remaining_credits=5,
            expires_at=datetime.utcnow() + timedelta(days=30)
        )
        db_session.add(user_package)
        
        # Create class that starts soon (within cancellation window)
        instructor = InstructorFactory()
        template = ClassTemplateFactory()
        db_session.add(instructor)
        db_session.add(template)
        await db_session.commit()
        
        soon_time = datetime.utcnow() + timedelta(minutes=30)  # Too soon to cancel
        class_instance = ClassInstance(
            template_id=template.id,
            instructor_id=instructor.id,
            start_datetime=soon_time,
            end_datetime=soon_time + timedelta(minutes=60),
            capacity=10
        )
        db_session.add(class_instance)
        await db_session.commit()
        
        booking = Booking(
            user_id=user.id,
            class_instance_id=class_instance.id,
            user_package_id=user_package.id,
            status=BookingStatus.CONFIRMED,
            credits_used=1,
            created_at=datetime.utcnow() - timedelta(hours=1)  # Booked earlier
        )
        db_session.add(booking)
        
        # Consume credit
        user_package.remaining_credits = 4
        await db_session.commit()
        
        booking_service = BookingService(db_session)
        
        # Attempt to cancel (should fail or not refund)
        with pytest.raises(ValueError, match="cancellation window"):
            await booking_service.cancel_booking(booking.id, user.id)
        
        # Credit should not be refunded
        await db_session.refresh(user_package)
        assert user_package.remaining_credits == 4


@pytest.mark.integration
class TestBookingBusinessRules:
    """Test booking business rules and limits."""

    @pytest.fixture
    async def user_with_unlimited_package(self, db_session: AsyncSession):
        """Create user with unlimited package."""
        user = UserFactory()
        package = PackageFactory(
            credits=None, 
            is_unlimited=True,
            validity_days=30
        )
        
        db_session.add(user)
        db_session.add(package)
        await db_session.commit()
        
        user_package = UserPackage(
            user_id=user.id,
            package_id=package.id,
            remaining_credits=None,
            expires_at=datetime.utcnow() + timedelta(days=30),
            is_active=True
        )
        db_session.add(user_package)
        await db_session.commit()
        
        return user, user_package

    @pytest.mark.asyncio
    async def test_weekly_booking_limit_enforcement(self, db_session: AsyncSession, user_with_unlimited_package):
        """Test that weekly booking limits are enforced."""
        user, user_package = user_with_unlimited_package
        booking_service = BookingService(db_session)
        
        # Create multiple class instances for this week
        instructor = InstructorFactory()
        template = ClassTemplateFactory()
        db_session.add(instructor)
        db_session.add(template)
        await db_session.commit()
        
        class_instances = []
        base_time = datetime.utcnow() + timedelta(hours=2)
        
        for i in range(settings.MAX_BOOKINGS_PER_WEEK + 2):  # Create more than the limit
            class_time = base_time + timedelta(hours=i*2)
            class_instance = ClassInstance(
                template_id=template.id,
                instructor_id=instructor.id,
                start_datetime=class_time,
                end_datetime=class_time + timedelta(minutes=60),
                capacity=10
            )
            db_session.add(class_instance)
            class_instances.append(class_instance)
        
        await db_session.commit()
        
        # Book up to the weekly limit
        successful_bookings = 0
        for i in range(settings.MAX_BOOKINGS_PER_WEEK):
            booking = await booking_service.create_booking(
                user_id=user.id,
                class_instance_id=class_instances[i].id,
                user_package_id=user_package.id
            )
            assert booking.status == BookingStatus.CONFIRMED
            successful_bookings += 1
        
        assert successful_bookings == settings.MAX_BOOKINGS_PER_WEEK
        
        # Attempt to book beyond the limit
        with pytest.raises(ValueError, match="weekly booking limit"):
            await booking_service.create_booking(
                user_id=user.id,
                class_instance_id=class_instances[-1].id,
                user_package_id=user_package.id
            )

    @pytest.mark.asyncio
    async def test_cannot_book_past_classes(self, db_session: AsyncSession, user_with_unlimited_package):
        """Test that users cannot book classes that have already started."""
        user, user_package = user_with_unlimited_package
        booking_service = BookingService(db_session)
        
        # Create a class in the past
        instructor = InstructorFactory()
        template = ClassTemplateFactory()
        db_session.add(instructor)
        db_session.add(template)
        await db_session.commit()
        
        past_time = datetime.utcnow() - timedelta(hours=1)
        past_class = ClassInstance(
            template_id=template.id,
            instructor_id=instructor.id,
            start_datetime=past_time,
            end_datetime=past_time + timedelta(minutes=60),
            capacity=10
        )
        db_session.add(past_class)
        await db_session.commit()
        
        # Attempt to book past class
        with pytest.raises(ValueError, match="past|already started"):
            await booking_service.create_booking(
                user_id=user.id,
                class_instance_id=past_class.id,
                user_package_id=user_package.id
            )

    @pytest.mark.asyncio
    async def test_cannot_double_book_same_class(self, db_session: AsyncSession, user_with_unlimited_package):
        """Test that users cannot book the same class twice."""
        user, user_package = user_with_unlimited_package
        booking_service = BookingService(db_session)
        
        # Create a class instance
        instructor = InstructorFactory()
        template = ClassTemplateFactory()
        db_session.add(instructor)
        db_session.add(template)
        await db_session.commit()
        
        future_time = datetime.utcnow() + timedelta(hours=24)
        class_instance = ClassInstance(
            template_id=template.id,
            instructor_id=instructor.id,
            start_datetime=future_time,
            end_datetime=future_time + timedelta(minutes=60),
            capacity=10
        )
        db_session.add(class_instance)
        await db_session.commit()
        
        # First booking should succeed
        booking1 = await booking_service.create_booking(
            user_id=user.id,
            class_instance_id=class_instance.id,
            user_package_id=user_package.id
        )
        assert booking1.status == BookingStatus.CONFIRMED
        
        # Second booking of same class should fail
        with pytest.raises(ValueError, match="already booked"):
            await booking_service.create_booking(
                user_id=user.id,
                class_instance_id=class_instance.id,
                user_package_id=user_package.id
            )


@pytest.mark.integration
class TestWaitlistLogic:
    """Test waitlist management and auto-promotion logic."""

    @pytest.fixture
    async def full_class_setup(self, db_session: AsyncSession):
        """Create a class at capacity with users."""
        # Create instructor and template
        instructor = InstructorFactory()
        template = ClassTemplateFactory(capacity=2)  # Small capacity for testing
        db_session.add(instructor)
        db_session.add(template)
        await db_session.commit()
        
        # Create class instance
        future_time = datetime.utcnow() + timedelta(hours=24)
        class_instance = ClassInstance(
            template_id=template.id,
            instructor_id=instructor.id,
            start_datetime=future_time,
            end_datetime=future_time + timedelta(minutes=60),
            capacity=2
        )
        db_session.add(class_instance)
        await db_session.commit()
        
        # Create users with packages
        users = []
        user_packages = []
        
        for i in range(4):  # More users than capacity
            user = UserFactory(email=f"user{i}@example.com")
            package = PackageFactory(credits=10)
            
            db_session.add(user)
            db_session.add(package)
            await db_session.commit()
            
            user_package = UserPackage(
                user_id=user.id,
                package_id=package.id,
                remaining_credits=10,
                expires_at=datetime.utcnow() + timedelta(days=30),
                is_active=True
            )
            db_session.add(user_package)
            await db_session.commit()
            
            users.append(user)
            user_packages.append(user_package)
        
        return class_instance, users, user_packages

    @pytest.mark.asyncio
    async def test_waitlist_auto_promotion(self, db_session: AsyncSession, full_class_setup):
        """Test automatic promotion from waitlist when spot becomes available."""
        class_instance, users, user_packages = full_class_setup
        booking_service = BookingService(db_session)
        
        # Fill the class to capacity
        booking1 = await booking_service.create_booking(
            user_id=users[0].id,
            class_instance_id=class_instance.id,
            user_package_id=user_packages[0].id
        )
        booking2 = await booking_service.create_booking(
            user_id=users[1].id,
            class_instance_id=class_instance.id,
            user_package_id=user_packages[1].id
        )
        
        assert booking1.status == BookingStatus.CONFIRMED
        assert booking2.status == BookingStatus.CONFIRMED
        
        # Next user should be waitlisted
        booking3 = await booking_service.create_booking(
            user_id=users[2].id,
            class_instance_id=class_instance.id,
            user_package_id=user_packages[2].id
        )
        assert booking3.status == BookingStatus.WAITLISTED
        
        # Another user joins waitlist
        booking4 = await booking_service.create_booking(
            user_id=users[3].id,
            class_instance_id=class_instance.id,
            user_package_id=user_packages[3].id
        )
        assert booking4.status == BookingStatus.WAITLISTED
        
        # Cancel first booking to open a spot
        cancelled_booking = await booking_service.cancel_booking(
            booking_id=booking1.id,
            user_id=users[0].id
        )
        assert cancelled_booking.status == BookingStatus.CANCELLED
        
        # Check if waitlisted user was automatically promoted
        await db_session.refresh(booking3)
        
        if settings.WAITLIST_AUTO_PROMOTION:
            # First waitlisted user should be promoted
            assert booking3.status == BookingStatus.CONFIRMED
            
            # Second waitlisted user should still be waitlisted
            await db_session.refresh(booking4)
            assert booking4.status == BookingStatus.WAITLISTED
        else:
            # Manual promotion required - both should still be waitlisted
            assert booking3.status == BookingStatus.WAITLISTED
            await db_session.refresh(booking4)
            assert booking4.status == BookingStatus.WAITLISTED

    @pytest.mark.asyncio
    async def test_waitlist_ordering(self, db_session: AsyncSession, full_class_setup):
        """Test that waitlist promotes users in the correct order (FIFO)."""
        class_instance, users, user_packages = full_class_setup
        booking_service = BookingService(db_session)
        
        # Fill class to capacity
        for i in range(2):
            await booking_service.create_booking(
                user_id=users[i].id,
                class_instance_id=class_instance.id,
                user_package_id=user_packages[i].id
            )
        
        # Add users to waitlist with delays to ensure ordering
        waitlist_booking1 = await booking_service.create_booking(
            user_id=users[2].id,
            class_instance_id=class_instance.id,
            user_package_id=user_packages[2].id
        )
        
        # Small delay to ensure different timestamps
        await asyncio.sleep(0.01)
        
        waitlist_booking2 = await booking_service.create_booking(
            user_id=users[3].id,
            class_instance_id=class_instance.id,
            user_package_id=user_packages[3].id
        )
        
        # Verify waitlist order
        waitlist_entries = await db_session.execute(
            """
            SELECT * FROM waitlist_entries 
            WHERE class_instance_id = :class_id 
            ORDER BY created_at ASC
            """,
            {"class_id": class_instance.id}
        )
        entries = waitlist_entries.fetchall()
        
        assert len(entries) == 2
        assert entries[0].user_id == users[2].id  # First to join waitlist
        assert entries[1].user_id == users[3].id  # Second to join waitlist


@pytest.mark.integration  
class TestPackageExpirationLogic:
    """Test package expiration business logic."""

    @pytest.mark.asyncio
    async def test_expired_package_prevents_booking(self, db_session: AsyncSession):
        """Test that expired packages cannot be used for bookings."""
        user = UserFactory()
        package = PackageFactory(credits=5, validity_days=30)
        
        db_session.add(user)
        db_session.add(package)
        await db_session.commit()
        
        # Create expired user package
        expired_package = UserPackage(
            user_id=user.id,
            package_id=package.id,
            remaining_credits=3,
            expires_at=datetime.utcnow() - timedelta(days=1),  # Expired
            is_active=True
        )
        db_session.add(expired_package)
        await db_session.commit()
        
        # Create class instance
        instructor = InstructorFactory()
        template = ClassTemplateFactory()
        db_session.add(instructor)
        db_session.add(template)
        await db_session.commit()
        
        future_time = datetime.utcnow() + timedelta(hours=24)
        class_instance = ClassInstance(
            template_id=template.id,
            instructor_id=instructor.id,
            start_datetime=future_time,
            end_datetime=future_time + timedelta(minutes=60),
            capacity=10
        )
        db_session.add(class_instance)
        await db_session.commit()
        
        booking_service = BookingService(db_session)
        
        # Attempt to book with expired package
        with pytest.raises(ValueError, match="expired|not valid"):
            await booking_service.create_booking(
                user_id=user.id,
                class_instance_id=class_instance.id,
                user_package_id=expired_package.id
            )

    @pytest.mark.asyncio
    async def test_package_expiration_batch_processing(self, db_session: AsyncSession):
        """Test batch processing of package expirations."""
        package_service = PackageService(db_session)
        
        # Create several users with packages that should expire
        expired_packages = []
        active_packages = []
        
        for i in range(5):
            user = UserFactory(email=f"expired{i}@example.com")
            package = PackageFactory(validity_days=30)
            
            db_session.add(user)
            db_session.add(package)
            await db_session.commit()
            
            # Expired package
            expired_package = UserPackage(
                user_id=user.id,
                package_id=package.id,
                remaining_credits=3,
                expires_at=datetime.utcnow() - timedelta(hours=1),
                is_active=True
            )
            db_session.add(expired_package)
            expired_packages.append(expired_package)
            
            # Active package for same user
            active_package = UserPackage(
                user_id=user.id,
                package_id=package.id,
                remaining_credits=5,
                expires_at=datetime.utcnow() + timedelta(days=10),
                is_active=True
            )
            db_session.add(active_package)
            active_packages.append(active_package)
        
        await db_session.commit()
        
        # Run expiration processing
        expired_count = await package_service.expire_packages()
        
        # Verify correct number of packages expired
        assert expired_count == 5
        
        # Verify expired packages are inactive
        for expired_package in expired_packages:
            await db_session.refresh(expired_package)
            assert expired_package.is_active is False
        
        # Verify active packages remain active  
        for active_package in active_packages:
            await db_session.refresh(active_package)
            assert active_package.is_active is True


if __name__ == "__main__":
    """Run business logic integration tests independently."""
    pytest.main([__file__, "-v", "-k", "integration"])