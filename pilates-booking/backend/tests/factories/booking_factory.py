"""
Booking-related test factories.
"""

import factory
from datetime import datetime
from faker import Faker

from app.models.booking import Booking, BookingStatus, WaitlistEntry, CancellationReason
from .base import BaseFactory
from .user_factory import UserFactory
from .class_factory import ClassInstanceFactory

fake = Faker()


class BookingFactory(BaseFactory):
    """Factory for creating bookings."""
    
    class Meta:
        model = Booking
        
    user = factory.SubFactory(UserFactory)
    class_instance = factory.SubFactory(ClassInstanceFactory)
    status = BookingStatus.CONFIRMED
    booking_date = factory.LazyFunction(datetime.utcnow)
    notes = factory.Faker("text", max_nb_chars=200)
    

class CancelledBookingFactory(BookingFactory):
    """Factory for cancelled bookings."""
    
    status = BookingStatus.CANCELLED
    cancellation_date = factory.LazyFunction(datetime.utcnow)
    cancellation_reason = CancellationReason.USER_CANCELLED


class CompletedBookingFactory(BookingFactory):
    """Factory for completed bookings."""
    
    status = BookingStatus.COMPLETED


class NoShowBookingFactory(BookingFactory):
    """Factory for no-show bookings."""
    
    status = BookingStatus.NO_SHOW


class WaitlistEntryFactory(BaseFactory):
    """Factory for creating waitlist entries."""
    
    class Meta:
        model = WaitlistEntry
        
    user = factory.SubFactory(UserFactory)
    class_instance = factory.SubFactory(ClassInstanceFactory)
    position = factory.Sequence(lambda n: n + 1)
    joined_date = factory.LazyFunction(datetime.utcnow)
    is_active = True