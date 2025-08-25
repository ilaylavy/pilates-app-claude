"""
Test factories for the Pilates Booking System.
Using factory_boy to create test data with realistic values.
"""

from .base import BaseFactory
from .user_factory import UserFactory, AdminFactory, InstructorFactory, InactiveUserFactory, UnverifiedUserFactory
from .class_factory import ClassTemplateFactory, ClassInstanceFactory
from .booking_factory import BookingFactory, WaitlistEntryFactory
from .package_factory import PackageFactory, UserPackageFactory
from .payment_factory import PaymentFactory, TransactionFactory

__all__ = [
    "BaseFactory",
    "UserFactory",
    "AdminFactory", 
    "InstructorFactory",
    "InactiveUserFactory",
    "UnverifiedUserFactory",
    "ClassTemplateFactory",
    "ClassInstanceFactory",
    "BookingFactory",
    "WaitlistEntryFactory",
    "PackageFactory",
    "UserPackageFactory",
    "PaymentFactory",
    "TransactionFactory",
]