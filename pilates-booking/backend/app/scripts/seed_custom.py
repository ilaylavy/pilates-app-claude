#!/usr/bin/env python3
"""
Custom seeding script - Configurable scenarios for specific testing needs.
Supports various testing scenarios through command line arguments.
"""
import argparse
import asyncio
import os
import sys
from datetime import datetime, time, timedelta
from random import choice, randint, random
from typing import List, Optional

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.booking import Booking, BookingStatus, WaitlistEntry
from app.models.class_schedule import (ClassInstance, ClassLevel, ClassStatus,
                                       ClassTemplate, WeekDay)
from app.models.friendship import Friendship, FriendshipStatus
from app.models.package import (Package, PaymentStatus, UserPackage,
                                 UserPackageStatus, ApprovalStatus)
from app.models.payment import Payment, PaymentMethod, PaymentType
from app.models.user import User, UserRole


class SeedingConfig:
    """Configuration class for custom seeding scenarios."""
    
    def __init__(self):
        # Default configuration
        self.scenario = "balanced"
        self.students = 20
        self.instructors = 3
        self.packages = 5
        self.weeks = 2
        self.social_features = True
        self.payment_history = True
        self.approval_pending = 0.2  # 20% packages pending approval
        self.booking_rate = 0.6  # 60% capacity on average
        self.friendship_rate = 0.5  # 50% of students have friends
        self.expired_packages = 0.1  # 10% expired packages
        
    @classmethod
    def from_scenario(cls, scenario: str) -> 'SeedingConfig':
        """Create configuration for predefined scenarios."""
        config = cls()
        config.scenario = scenario
        
        if scenario == "approval_testing":
            # Focus on package approval workflows
            config.students = 30
            config.approval_pending = 0.4  # 40% pending
            config.expired_packages = 0.05
            config.social_features = False
            
        elif scenario == "social_testing":
            # Focus on social features
            config.students = 40
            config.friendship_rate = 0.8  # 80% have friends
            config.social_features = True
            config.approval_pending = 0.1
            
        elif scenario == "booking_stress":
            # High booking load for testing
            config.students = 100
            config.instructors = 6
            config.weeks = 4
            config.booking_rate = 0.9  # 90% capacity
            config.approval_pending = 0.05
            
        elif scenario == "payment_testing":
            # Focus on payment scenarios
            config.students = 25
            config.payment_history = True
            config.approval_pending = 0.3
            config.expired_packages = 0.2
            
        elif scenario == "minimal":
            # Minimal data for quick testing
            config.students = 5
            config.instructors = 1
            config.packages = 3
            config.weeks = 1
            config.social_features = False
            config.payment_history = False
            config.approval_pending = 0.1
            
        elif scenario == "performance":
            # Large dataset for performance testing
            config.students = 150
            config.instructors = 8
            config.packages = 10
            config.weeks = 6
            config.booking_rate = 0.7
            
        return config


async def create_users_custom(session: AsyncSession, config: SeedingConfig) -> tuple[List[User], List[User], List[User]]:
    """Create users based on configuration."""
    users = []
    
    # Create admin
    admin = User(
        email="admin@pilates.com",
        hashed_password=get_password_hash("admin123"),
        first_name="Admin",
        last_name="User",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    users.append(admin)
    session.add(admin)
    
    # Create instructors
    instructors = []
    for i in range(config.instructors):
        instructor = User(
            email=f"instructor{i+1}@pilates.com",
            hashed_password=get_password_hash("instructor123"),
            first_name=f"Instructor",
            last_name=f"User{i+1}",
            phone=f"+123456{7000+i:04d}",
            role=UserRole.INSTRUCTOR,
            is_active=True,
            is_verified=True,
        )
        instructors.append(instructor)
        users.append(instructor)
        session.add(instructor)
    
    # Create students
    students = []
    for i in range(config.students):
        student = User(
            email=f"student{i+1}@example.com",
            hashed_password=get_password_hash("student123"),
            first_name=f"Student",
            last_name=f"User{i+1}",
            phone=f"+198765{4000+i:04d}" if random() > 0.3 else None,
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=random() > 0.05,  # 95% verified
        )
        students.append(student)
        users.append(student)
        session.add(student)
    
    await session.commit()
    
    for user in users:
        await session.refresh(user)
    
    return [admin], instructors, students


async def create_packages_custom(session: AsyncSession, config: SeedingConfig) -> List[Package]:
    """Create packages based on configuration."""
    base_packages = [
        ("Single Class", "Drop-in class", 1, 25.00, 7, False),
        ("5-Class Package", "Regular practitioner", 5, 110.00, 60, True),
        ("10-Class Package", "Best value", 10, 200.00, 90, True),
        ("Monthly Unlimited", "Unlimited for 30 days", 999, 150.00, 30, False, True),
        ("Student Special", "Discounted package", 5, 85.00, 45, False),
        ("Corporate Package", "Business wellness", 20, 400.00, 120, False),
        ("Trial Package", "First-time special", 3, 60.00, 30, False),
    ]
    
    packages = []
    for i, (name, desc, credits, price, validity, featured, *unlimited) in enumerate(base_packages[:config.packages]):
        is_unlimited = unlimited[0] if unlimited else False
        
        package = Package(
            name=name,
            description=desc,
            credits=credits,
            price=price,
            validity_days=validity,
            is_active=True,
            is_featured=featured,
            is_unlimited=is_unlimited,
            order_index=i+1,
        )
        packages.append(package)
        session.add(package)
    
    await session.commit()
    
    for package in packages:
        await session.refresh(package)
    
    return packages


async def create_class_schedule_custom(session: AsyncSession, instructors: List[User], config: SeedingConfig) -> tuple[List[ClassTemplate], List[ClassInstance]]:
    """Create class templates and instances."""
    # Base templates
    base_templates = [
        ("Morning Flow", "Start your day right", 60, 12, ClassLevel.ALL_LEVELS, WeekDay.MONDAY, time(8, 0)),
        ("Power Pilates", "High intensity", 45, 10, ClassLevel.ADVANCED, WeekDay.TUESDAY, time(18, 30)),
        ("Beginner Basics", "Learn fundamentals", 60, 8, ClassLevel.BEGINNER, WeekDay.WEDNESDAY, time(10, 0)),
        ("Lunch Break", "Quick session", 30, 15, ClassLevel.ALL_LEVELS, WeekDay.THURSDAY, time(12, 30)),
        ("Weekend Flow", "Weekend energy", 75, 12, ClassLevel.INTERMEDIATE, WeekDay.SATURDAY, time(10, 0)),
        ("Evening Calm", "End day peacefully", 60, 14, ClassLevel.ALL_LEVELS, WeekDay.FRIDAY, time(19, 0)),
    ]
    
    # Create templates (scale based on number of instructors)
    templates = []
    classes_per_instructor = max(2, len(base_templates) // len(instructors))
    
    for i, instructor in enumerate(instructors):
        start_idx = i * classes_per_instructor
        end_idx = min(start_idx + classes_per_instructor, len(base_templates))
        
        for template_data in base_templates[start_idx:end_idx]:
            name, desc, duration, capacity, level, day, start_time = template_data
            
            template = ClassTemplate(
                name=f"{name} (with {instructor.first_name})",
                description=desc,
                duration_minutes=duration,
                capacity=capacity,
                level=level,
                day_of_week=day,
                start_time=start_time,
                is_active=True,
            )
            templates.append(template)
            session.add(template)
    
    await session.commit()
    
    for template in templates:
        await session.refresh(template)
    
    # Create instances
    instances = []
    today = datetime.now().date()
    start_date = today + timedelta(days=(0 - today.weekday()))
    
    for week_offset in range(config.weeks):
        for template in templates:
            instructor = choice(instructors)
            
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
                notes=f"Week {week_offset + 1}",
            )
            instances.append(instance)
            session.add(instance)
    
    await session.commit()
    
    for instance in instances:
        await session.refresh(instance)
    
    return templates, instances


async def create_user_packages_custom(session: AsyncSession, students: List[User], 
                                    packages: List[Package], admins: List[User], config: SeedingConfig):
    """Create user packages with custom approval scenarios."""
    user_packages = []
    
    # 70% of students have packages
    students_with_packages = students[:int(len(students) * 0.7)]
    
    for student in students_with_packages:
        # Each student has 1-2 packages
        num_packages = randint(1, 2)
        
        for _ in range(num_packages):
            package = choice(packages)
            
            # Determine package timing
            days_ago = randint(1, 120)
            purchase_date = datetime.now() - timedelta(days=days_ago)
            expiry_date = purchase_date + timedelta(days=package.validity_days)
            
            # Determine if expired based on config
            if random() < config.expired_packages:
                # Force expiry
                expiry_date = datetime.now() - timedelta(days=randint(1, 30))
                status = UserPackageStatus.EXPIRED
                payment_status = PaymentStatus.PAYMENT_CONFIRMED
                approval_status = ApprovalStatus.PAYMENT_CONFIRMED
                credits_remaining = randint(0, package.credits) if not package.is_unlimited else 999
            else:
                # Active packages with various approval states
                if random() < config.approval_pending:
                    # Pending approval
                    status = UserPackageStatus.ACTIVE
                    if random() < 0.5:
                        payment_status = PaymentStatus.PENDING_APPROVAL
                        approval_status = ApprovalStatus.PENDING
                    else:
                        payment_status = PaymentStatus.AUTHORIZED
                        approval_status = ApprovalStatus.AUTHORIZED
                    credits_remaining = package.credits if not package.is_unlimited else 999
                else:
                    # Fully approved
                    status = UserPackageStatus.ACTIVE
                    payment_status = PaymentStatus.PAYMENT_CONFIRMED
                    approval_status = ApprovalStatus.PAYMENT_CONFIRMED
                    # Random usage
                    if package.is_unlimited:
                        credits_remaining = 999
                    else:
                        credits_remaining = randint(0, package.credits)
            
            user_package = UserPackage(
                user_id=student.id,
                package_id=package.id,
                credits_remaining=credits_remaining,
                purchase_date=purchase_date,
                expiry_date=expiry_date,
                status=status,
                payment_status=payment_status,
                approval_status=approval_status,
            )
            
            # Add approval details for processed packages
            if payment_status != PaymentStatus.PENDING_APPROVAL and admins:
                admin = choice(admins)
                user_package.authorized_by = admin.id
                user_package.authorized_at = purchase_date + timedelta(hours=randint(1, 24))
                
                if payment_status == PaymentStatus.PAYMENT_CONFIRMED:
                    user_package.payment_confirmed_by = admin.id
                    user_package.payment_confirmed_at = user_package.authorized_at + timedelta(hours=randint(1, 48))
            
            user_packages.append(user_package)
            session.add(user_package)
    
    await session.commit()
    return user_packages


async def create_bookings_custom(session: AsyncSession, students: List[User], 
                               instances: List[ClassInstance], config: SeedingConfig):
    """Create bookings based on configuration."""
    bookings = []
    
    for instance in instances:
        # Determine number of bookings based on config
        num_bookings = min(
            int(instance.template.capacity * config.booking_rate),
            len(students)
        )
        
        if num_bookings == 0:
            continue
        
        # Select random students
        class_students = students[:num_bookings]  # Take first N students
        
        for student in class_students:
            booking = Booking(
                user_id=student.id,
                class_instance_id=instance.id,
                status=BookingStatus.CONFIRMED,
                booking_date=instance.start_datetime - timedelta(days=randint(1, 7)),
            )
            bookings.append(booking)
            session.add(booking)
    
    await session.commit()
    return bookings


async def create_social_features_custom(session: AsyncSession, students: List[User], config: SeedingConfig):
    """Create social features if enabled."""
    if not config.social_features:
        return []
    
    friendships = []
    
    # Create friendships for percentage of students
    social_students = students[:int(len(students) * config.friendship_rate)]
    
    for i, student in enumerate(social_students):
        # Each student has 1-5 friends
        num_friends = randint(1, min(5, len(students) - 1))
        
        # Select friends (avoid self and duplicates)
        potential_friends = [s for s in students if s.id != student.id][:num_friends]
        
        for friend in potential_friends:
            # Check if friendship already exists
            existing = any(
                (f.user_id == student.id and f.friend_id == friend.id) or
                (f.user_id == friend.id and f.friend_id == student.id)
                for f in friendships
            )
            
            if not existing:
                status = choice([FriendshipStatus.ACCEPTED, FriendshipStatus.PENDING])
                requested_at = datetime.now() - timedelta(days=randint(1, 30))
                accepted_at = requested_at + timedelta(hours=randint(1, 168)) if status == FriendshipStatus.ACCEPTED else None
                
                friendship = Friendship(
                    user_id=student.id,
                    friend_id=friend.id,
                    status=status,
                    requested_at=requested_at,
                    accepted_at=accepted_at,
                )
                friendships.append(friendship)
                session.add(friendship)
    
    await session.commit()
    return friendships


async def create_payments_custom(session: AsyncSession, students: List[User], 
                               packages: List[Package], config: SeedingConfig):
    """Create payment history if enabled."""
    if not config.payment_history:
        return []
    
    payments = []
    
    # 60% of students have payment history
    paying_students = students[:int(len(students) * 0.6)]
    
    for student in paying_students:
        num_payments = randint(1, 3)
        
        for _ in range(num_payments):
            package = choice(packages)
            
            payment = Payment(
                user_id=student.id,
                package_id=package.id,
                amount=float(package.price),
                payment_type=PaymentType.PACKAGE_PURCHASE,
                payment_method=choice([PaymentMethod.CREDIT_CARD, PaymentMethod.CASH, PaymentMethod.STRIPE]),
                status=choice([PaymentStatus.COMPLETED, PaymentStatus.PENDING]),
                payment_date=datetime.now() - timedelta(days=randint(1, 90)),
                description=f"{package.name} Purchase",
            )
            payments.append(payment)
            session.add(payment)
    
    await session.commit()
    return payments


async def seed_custom(config: SeedingConfig):
    """Custom seeding based on configuration."""
    print(f"🌱 Starting custom seeding with scenario: {config.scenario}")
    print(f"📊 Configuration:")
    print(f"  - Students: {config.students}")
    print(f"  - Instructors: {config.instructors}")
    print(f"  - Packages: {config.packages}")
    print(f"  - Weeks: {config.weeks}")
    print(f"  - Approval pending: {config.approval_pending*100:.0f}%")
    print(f"  - Booking rate: {config.booking_rate*100:.0f}%")
    print(f"  - Social features: {config.social_features}")
    print(f"  - Payment history: {config.payment_history}")

    await init_db()

    async with AsyncSessionLocal() as session:
        print("👥 Creating users...")
        admins, instructors, students = await create_users_custom(session, config)
        
        print("📦 Creating packages...")
        packages = await create_packages_custom(session, config)
        
        print("📅 Creating class schedule...")
        templates, instances = await create_class_schedule_custom(session, instructors, config)
        
        print("💳 Creating user packages...")
        user_packages = await create_user_packages_custom(session, students, packages, admins, config)
        
        print("📝 Creating bookings...")
        bookings = await create_bookings_custom(session, students, instances, config)
        
        if config.social_features:
            print("👫 Creating social features...")
            friendships = await create_social_features_custom(session, students, config)
        else:
            friendships = []
        
        if config.payment_history:
            print("💰 Creating payment history...")
            payments = await create_payments_custom(session, students, packages, config)
        else:
            payments = []

    print("[SUCCESS] Custom seeding completed!")
    print("📊 Created:")
    print(f"  - {len(admins)} admins, {len(instructors)} instructors, {len(students)} students")
    print(f"  - {len(packages)} packages")
    print(f"  - {len(templates)} templates, {len(instances)} class instances")
    print(f"  - {len(user_packages)} user packages")
    print(f"  - {len(bookings)} bookings")
    if config.social_features:
        print(f"  - {len(friendships)} friendships")
    if config.payment_history:
        print(f"  - {len(payments)} payments")


def main():
    """Main function with command line argument parsing."""
    parser = argparse.ArgumentParser(description="Custom seeding script for Pilates booking system")
    
    # Predefined scenarios
    parser.add_argument("--scenario", 
                       choices=["balanced", "approval_testing", "social_testing", 
                               "booking_stress", "payment_testing", "minimal", "performance"],
                       default="balanced",
                       help="Predefined seeding scenario")
    
    # Custom parameters
    parser.add_argument("--students", type=int, help="Number of students to create")
    parser.add_argument("--instructors", type=int, help="Number of instructors to create")
    parser.add_argument("--packages", type=int, help="Number of packages to create")
    parser.add_argument("--weeks", type=int, help="Number of weeks of classes")
    parser.add_argument("--approval-pending", type=float, help="Percentage of packages pending approval (0.0-1.0)")
    parser.add_argument("--booking-rate", type=float, help="Average booking rate (0.0-1.0)")
    parser.add_argument("--no-social", action="store_true", help="Disable social features")
    parser.add_argument("--no-payments", action="store_true", help="Disable payment history")
    
    args = parser.parse_args()
    
    # Create configuration
    config = SeedingConfig.from_scenario(args.scenario)
    
    # Override with command line arguments
    if args.students is not None:
        config.students = args.students
    if args.instructors is not None:
        config.instructors = args.instructors
    if args.packages is not None:
        config.packages = args.packages
    if args.weeks is not None:
        config.weeks = args.weeks
    if args.approval_pending is not None:
        config.approval_pending = args.approval_pending
    if args.booking_rate is not None:
        config.booking_rate = args.booking_rate
    if args.no_social:
        config.social_features = False
    if args.no_payments:
        config.payment_history = False
    
    # Run seeding
    asyncio.run(seed_custom(config))


if __name__ == "__main__":
    main()