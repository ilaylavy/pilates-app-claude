#!/usr/bin/env python3
"""
Medium seeding script - Moderate data load for realistic testing.
Creates comprehensive data with multiple users, bookings, and social features.
"""
import asyncio
import os
import sys
from datetime import datetime, time, timedelta
from typing import List

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.booking import Booking, BookingStatus
from app.models.class_schedule import (ClassInstance, ClassLevel, ClassStatus,
                                       ClassTemplate, WeekDay)
from app.models.friendship import Friendship, FriendshipStatus
from app.models.package import (Package, UserPackage,
                                 UserPackageStatus, ApprovalStatus)
from app.models.package import PaymentStatus as PackagePaymentStatus
from app.models.payment import Payment, PaymentMethod, PaymentType, PaymentStatus
from app.models.user import User, UserRole


async def create_users(session: AsyncSession) -> List[User]:
    """Create diverse set of users for realistic testing."""
    users = [
        # Admin users
        User(
            email="admin@pilates.com",
            hashed_password=get_password_hash("admin123"),
            first_name="Admin",
            last_name="Master",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        ),
        # Instructors
        User(
            email="sarah@pilates.com",
            hashed_password=get_password_hash("instructor123"),
            first_name="Sarah",
            last_name="Johnson",
            phone="+1234567890",
            role=UserRole.INSTRUCTOR,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="mike@pilates.com",
            hashed_password=get_password_hash("instructor123"),
            first_name="Mike",
            last_name="Chen",
            phone="+1234567891",
            role=UserRole.INSTRUCTOR,
            is_active=True,
            is_verified=True,
        ),
        # Students
        User(
            email="alice@example.com",
            hashed_password=get_password_hash("student123"),
            first_name="Alice",
            last_name="Smith",
            phone="+1987654321",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="bob@example.com",
            hashed_password=get_password_hash("student123"),
            first_name="Bob",
            last_name="Wilson",
            phone="+1987654322",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="carol@example.com",
            hashed_password=get_password_hash("student123"),
            first_name="Carol",
            last_name="Davis",
            phone="+1987654323",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="david@example.com",
            hashed_password=get_password_hash("student123"),
            first_name="David",
            last_name="Brown",
            phone="+1987654324",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="emma@example.com",
            hashed_password=get_password_hash("student123"),
            first_name="Emma",
            last_name="Johnson",
            phone="+1987654325",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
    ]

    for user in users:
        session.add(user)
    await session.commit()
    
    for user in users:
        await session.refresh(user)
    
    return users


async def create_packages(session: AsyncSession) -> List[Package]:
    """Create comprehensive package options."""
    packages = [
        Package(
            name="Drop-in Class",
            description="Perfect for first-time visitors",
            credits=1,
            price=28.00,
            validity_days=7,
            is_active=True,
            order_index=1,
        ),
        Package(
            name="5-Class Package",
            description="Great for regular practitioners",
            credits=5,
            price=125.00,
            validity_days=60,
            is_active=True,
            order_index=2,
            is_featured=True,
        ),
        Package(
            name="10-Class Package",
            description="Best value for committed students",
            credits=10,
            price=220.00,
            validity_days=90,
            is_active=True,
            order_index=3,
            is_featured=True,
        ),
        Package(
            name="Monthly Unlimited",
            description="Unlimited classes for 30 days",
            credits=999,
            price=180.00,
            validity_days=30,
            is_unlimited=True,
            is_active=True,
            order_index=4,
        ),
        Package(
            name="Student Special",
            description="Discounted package for students",
            credits=5,
            price=85.00,
            validity_days=45,
            is_active=True,
            order_index=5,
        ),
    ]

    for package in packages:
        session.add(package)
    await session.commit()
    
    for package in packages:
        await session.refresh(package)
    
    return packages


async def create_class_templates(session: AsyncSession, instructors: List[User]) -> List[ClassTemplate]:
    """Create diverse class schedule templates."""
    templates = [
        # Sarah's classes
        ClassTemplate(
            name="Morning Flow",
            description="Gentle start to your day",
            duration_minutes=60,
            capacity=12,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.MONDAY,
            start_time=time(8, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="Power Pilates",
            description="High-intensity workout",
            duration_minutes=45,
            capacity=10,
            level=ClassLevel.ADVANCED,
            day_of_week=WeekDay.TUESDAY,
            start_time=time(18, 30),
            is_active=True,
        ),
        ClassTemplate(
            name="Beginner Basics",
            description="Learn the fundamentals",
            duration_minutes=60,
            capacity=8,
            level=ClassLevel.BEGINNER,
            day_of_week=WeekDay.WEDNESDAY,
            start_time=time(10, 0),
            is_active=True,
        ),
        # Mike's classes
        ClassTemplate(
            name="Lunch Break Pilates",
            description="Quick midday session",
            duration_minutes=30,
            capacity=15,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.THURSDAY,
            start_time=time(12, 30),
            is_active=True,
        ),
        ClassTemplate(
            name="Weekend Warrior",
            description="Energizing weekend class",
            duration_minutes=75,
            capacity=12,
            level=ClassLevel.INTERMEDIATE,
            day_of_week=WeekDay.SATURDAY,
            start_time=time(10, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="Evening Flow",
            description="Unwind after work",
            duration_minutes=60,
            capacity=14,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.FRIDAY,
            start_time=time(19, 0),
            is_active=True,
        ),
    ]

    for template in templates:
        session.add(template)
    await session.commit()
    
    for template in templates:
        await session.refresh(template)
    
    return templates


async def create_user_packages(session: AsyncSession, users: List[User], packages: List[Package]):
    """Create user packages with various statuses."""
    students = [u for u in users if u.role == UserRole.STUDENT]
    
    user_packages = []
    
    # Alice has an active 10-class package
    user_packages.append(UserPackage(
        user_id=students[0].id,  # Alice
        package_id=packages[2].id,  # 10-class package
        credits_remaining=8,
        purchase_date=datetime.now() - timedelta(days=10),
        expiry_date=datetime.now() + timedelta(days=80),
        status=UserPackageStatus.ACTIVE,
        payment_status=PackagePaymentStatus.PAYMENT_CONFIRMED,
        approval_status=ApprovalStatus.PAYMENT_CONFIRMED,
    ))
    
    # Bob has a pending approval package
    user_packages.append(UserPackage(
        user_id=students[1].id,  # Bob
        package_id=packages[1].id,  # 5-class package
        credits_remaining=5,
        purchase_date=datetime.now() - timedelta(days=1),
        expiry_date=datetime.now() + timedelta(days=59),
        status=UserPackageStatus.ACTIVE,
        payment_status=PackagePaymentStatus.PENDING_APPROVAL,
        approval_status=ApprovalStatus.PENDING,
    ))
    
    # Carol has an authorized package (waiting for payment confirmation)
    user_packages.append(UserPackage(
        user_id=students[2].id,  # Carol
        package_id=packages[1].id,  # 5-class package
        credits_remaining=5,
        purchase_date=datetime.now() - timedelta(hours=2),
        expiry_date=datetime.now() + timedelta(days=60),
        status=UserPackageStatus.ACTIVE,
        payment_status=PackagePaymentStatus.AUTHORIZED,
        approval_status=ApprovalStatus.AUTHORIZED,
        authorized_by=users[0].id,  # Admin
        authorized_at=datetime.now() - timedelta(hours=1),
    ))
    
    # David has an expired package
    user_packages.append(UserPackage(
        user_id=students[3].id,  # David
        package_id=packages[0].id,  # Drop-in class
        credits_remaining=0,
        purchase_date=datetime.now() - timedelta(days=20),
        expiry_date=datetime.now() - timedelta(days=5),
        status=UserPackageStatus.EXPIRED,
        payment_status=PackagePaymentStatus.PAYMENT_CONFIRMED,
        approval_status=ApprovalStatus.PAYMENT_CONFIRMED,
    ))
    
    # Emma has multiple packages
    user_packages.extend([
        UserPackage(
            user_id=students[4].id,  # Emma
            package_id=packages[3].id,  # Monthly unlimited
            credits_remaining=999,
            purchase_date=datetime.now() - timedelta(days=5),
            expiry_date=datetime.now() + timedelta(days=25),
            status=UserPackageStatus.ACTIVE,
            payment_status=PackagePaymentStatus.PAYMENT_CONFIRMED,
            approval_status=ApprovalStatus.PAYMENT_CONFIRMED,
        ),
        UserPackage(
            user_id=students[4].id,  # Emma
            package_id=packages[4].id,  # Student special
            credits_remaining=3,
            purchase_date=datetime.now() - timedelta(days=15),
            expiry_date=datetime.now() + timedelta(days=30),
            status=UserPackageStatus.ACTIVE,
            payment_status=PackagePaymentStatus.PAYMENT_CONFIRMED,
            approval_status=ApprovalStatus.PAYMENT_CONFIRMED,
        ),
    ])

    for user_package in user_packages:
        session.add(user_package)
    await session.commit()


async def create_class_instances(session: AsyncSession, instructors: List[User], templates: List[ClassTemplate]) -> List[ClassInstance]:
    """Create class instances for the next month."""
    instances = []
    
    # Get current date and create instances for 4 weeks
    today = datetime.now().date()
    start_date = today + timedelta(days=(0 - today.weekday()))  # Start from this Monday
    
    sarah = instructors[0]  # First instructor
    mike = instructors[1]   # Second instructor
    
    for week_offset in range(4):  # 4 weeks
        for template in templates:
            # Assign instructors to classes
            instructor = sarah if template.name in ["Morning Flow", "Power Pilates", "Beginner Basics"] else mike
            
            days_ahead = list(WeekDay).index(template.day_of_week)
            class_date = start_date + timedelta(days=days_ahead + (week_offset * 7))
            
            start_datetime = datetime.combine(class_date, template.start_time)
            end_datetime = start_datetime + timedelta(minutes=template.duration_minutes)
            
            instance = ClassInstance(
                template_id=template.id,
                instructor_id=instructor.id,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
                status=ClassStatus.SCHEDULED,
                notes=f"Week {week_offset + 1} - {template.name}",
            )
            session.add(instance)
            instances.append(instance)
    
    await session.commit()
    
    for instance in instances:
        await session.refresh(instance)
    
    return instances


async def create_bookings(session: AsyncSession, users: List[User], instances: List[ClassInstance]):
    """Create sample bookings."""
    students = [u for u in users if u.role == UserRole.STUDENT]
    
    # Create some bookings for the first few classes
    bookings = []
    
    # Alice books several classes
    for i in range(3):
        if i < len(instances):
            booking = Booking(
                user_id=students[0].id,  # Alice
                class_instance_id=instances[i].id,
                status=BookingStatus.CONFIRMED,
                booking_date=datetime.now() - timedelta(days=2),
            )
            bookings.append(booking)
    
    # Emma books classes with her unlimited package
    for i in range(2, 5):
        if i < len(instances):
            booking = Booking(
                user_id=students[4].id,  # Emma
                class_instance_id=instances[i].id,
                status=BookingStatus.CONFIRMED,
                booking_date=datetime.now() - timedelta(days=1),
            )
            bookings.append(booking)
    
    # Add a cancelled booking
    if len(instances) > 5:
        cancelled_booking = Booking(
            user_id=students[1].id,  # Bob
            class_instance_id=instances[5].id,
            status=BookingStatus.CANCELLED,
            booking_date=datetime.now() - timedelta(days=3),
            cancellation_date=datetime.now() - timedelta(days=1),
        )
        bookings.append(cancelled_booking)

    for booking in bookings:
        session.add(booking)
    await session.commit()


async def create_friendships(session: AsyncSession, users: List[User]):
    """Create sample friendships and social connections."""
    students = [u for u in users if u.role == UserRole.STUDENT]
    
    friendships = [
        # Alice and Bob are friends
        Friendship(
            user_id=students[0].id,  # Alice
            friend_id=students[1].id,  # Bob
            status=FriendshipStatus.ACCEPTED,
            requested_at=datetime.now() - timedelta(days=5),
            accepted_at=datetime.now() - timedelta(days=4),
        ),
        # Carol sent friend request to Alice (pending)
        Friendship(
            user_id=students[2].id,  # Carol
            friend_id=students[0].id,  # Alice
            status=FriendshipStatus.PENDING,
            requested_at=datetime.now() - timedelta(days=2),
        ),
        # Emma and David are friends
        Friendship(
            user_id=students[4].id,  # Emma
            friend_id=students[3].id,  # David
            status=FriendshipStatus.ACCEPTED,
            requested_at=datetime.now() - timedelta(days=7),
            accepted_at=datetime.now() - timedelta(days=6),
        ),
    ]

    for friendship in friendships:
        session.add(friendship)
    await session.commit()


async def create_payments(session: AsyncSession, users: List[User], packages: List[Package]):
    """Create sample payment records."""
    students = [u for u in users if u.role == UserRole.STUDENT]
    
    payments = [
        # Alice's completed payment
        Payment(
            user_id=students[0].id,  # Alice
            package_id=packages[2].id,  # 10-class package
            amount=220.00,
            payment_type=PaymentType.PACKAGE_PURCHASE,
            payment_method=PaymentMethod.STRIPE,
            status=PaymentStatus.COMPLETED,
            payment_date=datetime.now() - timedelta(days=10),
            external_transaction_id="pi_1234567890",
            description="10-Class Package Purchase",
        ),
        # Emma's unlimited package payment
        Payment(
            user_id=students[4].id,  # Emma
            package_id=packages[3].id,  # Monthly unlimited
            amount=180.00,
            payment_type=PaymentType.PACKAGE_PURCHASE,
            payment_method=PaymentMethod.CREDIT_CARD,
            status=PaymentStatus.COMPLETED,
            payment_date=datetime.now() - timedelta(days=5),
            description="Monthly Unlimited Package",
        ),
        # Bob's pending payment
        Payment(
            user_id=students[1].id,  # Bob
            package_id=packages[1].id,  # 5-class package
            amount=125.00,
            payment_type=PaymentType.PACKAGE_PURCHASE,
            payment_method=PaymentMethod.CASH,
            status=PaymentStatus.PENDING,
            description="5-Class Package - Cash Payment",
        ),
    ]

    for payment in payments:
        session.add(payment)
    await session.commit()


async def clear_existing_data(session: AsyncSession):
    """Clear existing data to avoid conflicts."""
    print("[INFO] Clearing existing data...")
    
    # Clear in correct order to respect foreign key constraints
    await session.execute(text("DELETE FROM audit_logs"))
    await session.execute(text("DELETE FROM payments"))
    await session.execute(text("DELETE FROM friendships"))
    await session.execute(text("DELETE FROM bookings"))
    await session.execute(text("DELETE FROM waitlist_entries"))
    await session.execute(text("DELETE FROM class_instances"))
    await session.execute(text("DELETE FROM class_templates"))
    await session.execute(text("DELETE FROM user_packages"))
    await session.execute(text("DELETE FROM packages"))
    await session.execute(text("DELETE FROM users"))
    await session.commit()
    print("[INFO] Existing data cleared.")


async def seed_medium():
    """Medium seeding - comprehensive data for realistic testing."""
    print("[SEED] Starting medium database seeding...")

    await init_db()

    async with AsyncSessionLocal() as session:
        # Clear existing data first
        await clear_existing_data(session)
        
        # Create all entities
        print("[INFO] Creating users...")
        users = await create_users(session)
        
        print("[INFO] Creating packages...")
        packages = await create_packages(session)
        
        print("[INFO] Creating class templates...")
        instructors = [u for u in users if u.role == UserRole.INSTRUCTOR]
        templates = await create_class_templates(session, instructors)
        
        print("[INFO] Creating user packages...")
        await create_user_packages(session, users, packages)
        
        print("[INFO] Creating class instances...")
        instances = await create_class_instances(session, instructors, templates)
        
        print("[INFO] Creating bookings...")
        await create_bookings(session, users, instances)
        
        print("[INFO] Creating friendships...")
        await create_friendships(session, users)
        
        print("[INFO] Creating payments...")
        await create_payments(session, users, packages)

    print("[SUCCESS] Medium seeding completed!")
    print("[STATS] Created:")
    print("  - 8 users (1 admin, 2 instructors, 5 students)")
    print("  - 5 packages with various features")
    print("  - 6 class templates across the week")
    print("  - 24 class instances (4 weeks)")
    print("  - Multiple bookings and user packages")
    print("  - Social connections and payment records")


if __name__ == "__main__":
    asyncio.run(seed_medium())