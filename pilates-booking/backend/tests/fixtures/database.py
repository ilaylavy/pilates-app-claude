"""
Database-related test fixtures.
"""

import pytest
import pytest_asyncio
import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text

from tests.conftest import TestSessionLocal


@pytest_asyncio.fixture
async def clean_db():
    """Fixture that provides a clean database state."""
    async with TestSessionLocal() as session:
        # Clear all tables in reverse order to avoid foreign key constraints
        await session.execute(text("DELETE FROM waitlist_entries"))
        await session.execute(text("DELETE FROM bookings"))
        await session.execute(text("DELETE FROM transactions"))
        await session.execute(text("DELETE FROM payments"))
        await session.execute(text("DELETE FROM user_packages"))
        await session.execute(text("DELETE FROM packages"))
        await session.execute(text("DELETE FROM class_instances"))
        await session.execute(text("DELETE FROM class_templates"))
        await session.execute(text("DELETE FROM friendships"))
        await session.execute(text("DELETE FROM refresh_tokens"))
        await session.execute(text("DELETE FROM audit_logs"))
        await session.execute(text("DELETE FROM users"))
        
        # Reset sequences (for SQLite this might not be needed)
        await session.execute(text("DELETE FROM sqlite_sequence WHERE name IN ('users', 'packages', 'class_templates', 'class_instances', 'bookings', 'payments', 'transactions', 'user_packages', 'waitlist_entries', 'friendships', 'refresh_tokens', 'audit_logs')"))
        
        await session.commit()
        yield session


@pytest_asyncio.fixture
async def sample_data(clean_db: AsyncSession):
    """Fixture that provides a database with sample test data."""
    from tests.factories import (
        UserFactory, AdminFactory, InstructorFactory,
        ClassTemplateFactory, ClassInstanceFactory,
        PackageFactory, UserPackageFactory,
        BookingFactory, PaymentFactory
    )
    
    # Set the session for factories
    for factory_class in [UserFactory, AdminFactory, InstructorFactory,
                         ClassTemplateFactory, ClassInstanceFactory,
                         PackageFactory, UserPackageFactory,
                         BookingFactory, PaymentFactory]:
        factory_class._meta.sqlalchemy_session = clean_db
    
    # Create users
    students = UserFactory.create_batch(5)
    instructors = InstructorFactory.create_batch(2)
    admin = AdminFactory.create()
    
    # Create packages
    packages = PackageFactory.create_batch(3)
    
    # Create class templates and instances
    templates = ClassTemplateFactory.create_batch(4)
    instances = []
    for template in templates:
        for instructor in instructors:
            instance = ClassInstanceFactory.create(
                template=template,
                instructor=instructor
            )
            instances.append(instance)
    
    # Create user packages
    user_packages = []
    for student in students:
        for package in packages[:2]:  # Each student gets 2 packages
            user_package = UserPackageFactory.create(
                user=student,
                package=package
            )
            user_packages.append(user_package)
    
    # Create some bookings
    bookings = []
    for i, instance in enumerate(instances[:3]):  # Book first 3 instances
        for j, student in enumerate(students[:2]):  # First 2 students book each
            booking = BookingFactory.create(
                user=student,
                class_instance=instance
            )
            bookings.append(booking)
    
    # Create payments
    payments = []
    for user_package in user_packages:
        payment = PaymentFactory.create(
            user=user_package.user,
            package=user_package.package
        )
        payments.append(payment)
    
    await clean_db.commit()
    
    return {
        'students': students,
        'instructors': instructors,
        'admin': admin,
        'packages': packages,
        'templates': templates,
        'instances': instances,
        'user_packages': user_packages,
        'bookings': bookings,
        'payments': payments
    }