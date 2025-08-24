#!/usr/bin/env python3
"""
Heavy seeding script - Large dataset for performance testing and load scenarios.
Creates extensive data with hundreds of users, classes, and complex relationships.
"""
import asyncio
import os
import sys
from datetime import datetime, time, timedelta
from random import choice, randint, random, sample
from typing import List

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.booking import Booking, BookingStatus, WaitlistEntry
from app.models.class_schedule import (ClassInstance, ClassLevel, ClassStatus,
                                       ClassTemplate, WeekDay)
from app.models.friendship import Friendship, FriendshipStatus
from app.models.package import (Package, UserPackage,
                                 UserPackageStatus, ApprovalStatus)
from app.models.package import PaymentStatus as PackagePaymentStatus  
from app.models.payment import Payment, PaymentMethod, PaymentType, PaymentStatus
from app.models.user import User, UserRole


# Sample data for realistic names and details
FIRST_NAMES = [
    "Emma", "Olivia", "Ava", "Isabella", "Sophia", "Mia", "Charlotte", "Amelia", "Harper", "Evelyn",
    "Liam", "Noah", "Oliver", "Elijah", "William", "James", "Benjamin", "Lucas", "Henry", "Alexander",
    "Zoe", "Grace", "Chloe", "Victoria", "Samantha", "Madison", "Elizabeth", "Hannah", "Addison", "Lily",
    "Daniel", "Matthew", "Jackson", "David", "Logan", "Joseph", "Anthony", "Joshua", "Christopher", "Andrew",
]

LAST_NAMES = [
    "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
    "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
]

CLASS_NAMES = [
    "Morning Flow", "Power Pilates", "Beginner Basics", "Advanced Core", "Sunset Stretch",
    "Lunch Break", "Weekend Warrior", "Gentle Recovery", "Athletic Conditioning", "Flexibility Focus",
    "Core Strength", "Balance & Stability", "Prenatal Pilates", "Senior Friendly", "Teen Pilates",
    "Mat Essentials", "Reformer Intro", "Tower Power", "Ring Challenge", "Ball Blast",
]

CLASS_DESCRIPTIONS = [
    "A flowing sequence to energize your day",
    "High-intensity workout for experienced practitioners",
    "Perfect introduction to Pilates fundamentals",
    "Advanced core strengthening and stability",
    "Gentle stretching and relaxation",
    "Quick efficient workout for busy schedules",
    "Challenging weekend session",
    "Restorative practice for recovery",
    "Athletic-focused strength and conditioning",
    "Deep stretches for improved flexibility",
]


async def create_admin_users(session: AsyncSession) -> List[User]:
    """Create admin and system users."""
    admins = [
        User(
            email="admin@pilates.com",
            hashed_password=get_password_hash("admin123"),
            first_name="Super",
            last_name="Admin",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="manager@pilates.com",
            hashed_password=get_password_hash("manager123"),
            first_name="Studio",
            last_name="Manager",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        ),
    ]

    for admin in admins:
        session.add(admin)
    await session.commit()
    
    for admin in admins:
        await session.refresh(admin)
    
    return admins


async def create_instructors(session: AsyncSession, count: int = 12) -> List[User]:
    """Create multiple instructors with diverse profiles."""
    instructors = []
    
    for i in range(count):
        first_name = choice(FIRST_NAMES)
        last_name = choice(LAST_NAMES)
        email = f"instructor{i+1}@pilates.com"
        
        instructor = User(
            email=email,
            hashed_password=get_password_hash("instructor123"),
            first_name=first_name,
            last_name=last_name,
            phone=f"+123456{7000+i:04d}",
            role=UserRole.INSTRUCTOR,
            is_active=True,
            is_verified=True,
        )
        instructors.append(instructor)
        session.add(instructor)
    
    await session.commit()
    
    for instructor in instructors:
        await session.refresh(instructor)
    
    return instructors


async def create_students(session: AsyncSession, count: int = 200) -> List[User]:
    """Create large number of student users."""
    students = []
    
    for i in range(count):
        first_name = choice(FIRST_NAMES)
        last_name = choice(LAST_NAMES)
        email = f"student{i+1}@example.com"
        
        # Some users might not be verified or active
        is_verified = random() > 0.1  # 90% verified
        is_active = random() > 0.05   # 95% active
        
        student = User(
            email=email,
            hashed_password=get_password_hash("student123"),
            first_name=first_name,
            last_name=last_name,
            phone=f"+198765{4000+i:04d}" if random() > 0.3 else None,  # 70% have phone
            role=UserRole.STUDENT,
            is_active=is_active,
            is_verified=is_verified,
        )
        students.append(student)
        session.add(student)
        
        # Commit in batches to avoid memory issues
        if i % 50 == 49:
            await session.commit()
    
    await session.commit()
    
    # Refresh all students (in batches)
    for i in range(0, len(students), 50):
        batch = students[i:i+50]
        for student in batch:
            await session.refresh(student)
    
    return students


async def create_comprehensive_packages(session: AsyncSession) -> List[Package]:
    """Create diverse package options for different user needs."""
    packages = [
        # Basic packages
        Package(
            name="Trial Class",
            description="First-time visitor special",
            credits=1,
            price=15.00,
            validity_days=3,
            is_active=True,
            order_index=1,
        ),
        Package(
            name="Drop-in Class",
            description="Single class pass",
            credits=1,
            price=30.00,
            validity_days=7,
            is_active=True,
            order_index=2,
        ),
        
        # Multi-class packages
        Package(
            name="3-Class Starter",
            description="Perfect for trying different classes",
            credits=3,
            price=80.00,
            validity_days=30,
            is_active=True,
            order_index=3,
        ),
        Package(
            name="5-Class Package",
            description="Regular practitioner favorite",
            credits=5,
            price=130.00,
            validity_days=60,
            is_active=True,
            order_index=4,
            is_featured=True,
        ),
        Package(
            name="10-Class Package",
            description="Best value for committed students",
            credits=10,
            price=240.00,
            validity_days=90,
            is_active=True,
            order_index=5,
            is_featured=True,
        ),
        Package(
            name="20-Class Mega Pack",
            description="Ultimate value for dedicated practitioners",
            credits=20,
            price=450.00,
            validity_days=120,
            is_active=True,
            order_index=6,
        ),
        
        # Unlimited packages
        Package(
            name="Weekly Unlimited",
            description="Unlimited classes for 7 days",
            credits=999,
            price=75.00,
            validity_days=7,
            is_unlimited=True,
            is_active=True,
            order_index=7,
        ),
        Package(
            name="Monthly Unlimited",
            description="Unlimited classes for 30 days",
            credits=999,
            price=200.00,
            validity_days=30,
            is_unlimited=True,
            is_active=True,
            order_index=8,
            is_featured=True,
        ),
        Package(
            name="Quarterly Unlimited",
            description="3 months of unlimited classes",
            credits=999,
            price=540.00,
            validity_days=90,
            is_unlimited=True,
            is_active=True,
            order_index=9,
        ),
        
        # Special packages
        Package(
            name="Student Discount",
            description="Special pricing for students with ID",
            credits=5,
            price=95.00,
            validity_days=45,
            is_active=True,
            order_index=10,
        ),
        Package(
            name="Senior Package",
            description="Discounted package for 65+",
            credits=10,
            price=200.00,
            validity_days=120,
            is_active=True,
            order_index=11,
        ),
        Package(
            name="Corporate Package",
            description="Company wellness program",
            credits=25,
            price=500.00,
            validity_days=90,
            is_active=True,
            order_index=12,
        ),
        
        # Inactive/legacy packages
        Package(
            name="Old Pricing Model",
            description="Discontinued package",
            credits=8,
            price=150.00,
            validity_days=60,
            is_active=False,
            order_index=13,
        ),
    ]

    for package in packages:
        session.add(package)
    await session.commit()
    
    for package in packages:
        await session.refresh(package)
    
    return packages


async def create_diverse_class_templates(session: AsyncSession, instructors: List[User]) -> List[ClassTemplate]:
    """Create comprehensive class schedule with multiple instructors."""
    templates = []
    
    # Define class times throughout the week
    time_slots = [
        time(6, 30),   # Early morning
        time(8, 0),    # Morning
        time(9, 30),   # Mid-morning
        time(11, 0),   # Late morning
        time(12, 30),  # Lunch
        time(14, 0),   # Afternoon
        time(17, 0),   # Early evening
        time(18, 30),  # Evening
        time(20, 0),   # Late evening
    ]
    
    levels = [ClassLevel.BEGINNER, ClassLevel.INTERMEDIATE, ClassLevel.ADVANCED, ClassLevel.ALL_LEVELS]
    weekdays = list(WeekDay)
    
    # Create 3-4 classes per day across the week
    for day in weekdays:
        day_classes = []
        used_times = set()
        
        # 3-4 classes per day
        classes_today = randint(3, 4)
        
        for i in range(classes_today):
            # Pick unique time slot
            available_times = [t for t in time_slots if t not in used_times]
            if not available_times:
                break
                
            class_time = choice(available_times)
            used_times.add(class_time)
            
            # Pick class details
            class_name = choice(CLASS_NAMES)
            # Make name unique for this time slot
            unique_name = f"{class_name} ({class_time.strftime('%H:%M')})"
            
            template = ClassTemplate(
                name=unique_name,
                description=choice(CLASS_DESCRIPTIONS),
                duration_minutes=choice([30, 45, 60, 75]),
                capacity=randint(8, 20),
                level=choice(levels),
                day_of_week=day,
                start_time=class_time,
                is_active=random() > 0.1,  # 90% active
            )
            
            templates.append(template)
            session.add(template)
    
    await session.commit()
    
    for template in templates:
        await session.refresh(template)
    
    return templates


async def create_extensive_class_instances(session: AsyncSession, instructors: List[User], 
                                         templates: List[ClassTemplate], weeks: int = 8) -> List[ClassInstance]:
    """Create class instances for multiple weeks with realistic scheduling."""
    instances = []
    
    today = datetime.now().date()
    start_date = today + timedelta(days=(0 - today.weekday()))  # Start from this Monday
    
    for week_offset in range(weeks):
        for template in templates:
            if not template.is_active:
                continue
                
            # Random chance to skip a class (instructor unavailable, etc.)
            if random() < 0.05:  # 5% chance to skip
                continue
            
            # Assign instructor (rotate or random)
            instructor = choice(instructors)
            
            days_ahead = list(WeekDay).index(template.day_of_week)
            class_date = start_date + timedelta(days=days_ahead + (week_offset * 7))
            
            # Skip past dates
            if class_date < today:
                continue
            
            start_datetime = datetime.combine(class_date, template.start_time)
            end_datetime = start_datetime + timedelta(minutes=template.duration_minutes)
            
            # Determine status based on timing
            if class_date < today:
                status = choice([ClassStatus.COMPLETED, ClassStatus.CANCELLED])
            elif class_date == today:
                status = ClassStatus.SCHEDULED  # Today's classes are scheduled
            else:
                status = ClassStatus.SCHEDULED
            
            instance = ClassInstance(
                template_id=template.id,
                instructor_id=instructor.id,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
                status=status,
                notes=f"Week {week_offset + 1}" + (" - AUTO" if random() > 0.7 else ""),
            )
            session.add(instance)
            instances.append(instance)
            
            # Commit in batches
            if len(instances) % 100 == 99:
                await session.commit()
    
    await session.commit()
    
    # Refresh in batches
    for i in range(0, len(instances), 100):
        batch = instances[i:i+100]
        for instance in batch:
            await session.refresh(instance)
    
    return instances


async def create_user_packages_bulk(session: AsyncSession, students: List[User], 
                                  packages: List[Package], admins: List[User]):
    """Create large number of user packages with various statuses."""
    user_packages = []
    
    # 60% of students have packages
    students_with_packages = sample(students, int(len(students) * 0.6))
    
    for student in students_with_packages:
        # Each student has 1-3 packages (some current, some expired)
        num_packages = randint(1, 3)
        
        for _ in range(num_packages):
            package = choice([p for p in packages if p.is_active])
            
            # Determine package age and status
            days_ago = randint(1, 180)
            purchase_date = datetime.now() - timedelta(days=days_ago)
            expiry_date = purchase_date + timedelta(days=package.validity_days)
            
            # Determine credits based on usage
            if package.is_unlimited:
                credits_remaining = 999
            else:
                # Random usage pattern
                usage_percent = random()
                if expiry_date < datetime.now():
                    # Expired packages might be fully used or partially used
                    credits_remaining = randint(0, package.credits)
                else:
                    # Active packages have varying usage
                    credits_remaining = int(package.credits * (1 - usage_percent))
            
            # Determine status and payment status
            if expiry_date < datetime.now():
                status = UserPackageStatus.EXPIRED
                payment_status = PackagePaymentStatus.PAYMENT_CONFIRMED
                approval_status = ApprovalStatus.PAYMENT_CONFIRMED
            else:
                # Active packages with various approval states
                rand = random()
                if rand < 0.7:  # 70% fully approved
                    status = UserPackageStatus.ACTIVE
                    payment_status = PackagePaymentStatus.PAYMENT_CONFIRMED
                    approval_status = ApprovalStatus.PAYMENT_CONFIRMED
                elif rand < 0.85:  # 15% authorized but not confirmed
                    status = UserPackageStatus.ACTIVE
                    payment_status = PackagePaymentStatus.AUTHORIZED
                    approval_status = ApprovalStatus.AUTHORIZED
                elif rand < 0.95:  # 10% pending approval
                    status = UserPackageStatus.ACTIVE
                    payment_status = PackagePaymentStatus.PENDING_APPROVAL
                    approval_status = ApprovalStatus.PENDING
                else:  # 5% rejected
                    status = UserPackageStatus.CANCELLED
                    payment_status = PackagePaymentStatus.REJECTED
                    approval_status = ApprovalStatus.REJECTED
            
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
            if payment_status != PackagePaymentStatus.PENDING_APPROVAL:
                admin = choice(admins)
                user_package.authorized_by = admin.id
                user_package.authorized_at = purchase_date + timedelta(hours=randint(1, 24))
                
                if payment_status == PackagePaymentStatus.PAYMENT_CONFIRMED:
                    user_package.payment_confirmed_by = admin.id
                    user_package.payment_confirmed_at = user_package.authorized_at + timedelta(hours=randint(1, 48))
            
            user_packages.append(user_package)
            session.add(user_package)
            
            # Commit in batches
            if len(user_packages) % 100 == 99:
                await session.commit()
    
    await session.commit()
    return user_packages


async def create_bulk_bookings(session: AsyncSession, students: List[User], 
                             instances: List[ClassInstance]):
    """Create realistic booking patterns for performance testing."""
    bookings = []
    
    # Filter to only future and recent past instances
    today = datetime.now().date()
    relevant_instances = [
        inst for inst in instances 
        if inst.start_datetime.date() >= (today - timedelta(days=30))
    ]
    
    # Create bookings for 40% of capacity on average
    for instance in relevant_instances:
        # Determine booking rate (some classes are more popular)
        popularity = random()
        if popularity > 0.8:  # 20% are very popular
            booking_rate = 0.9
        elif popularity > 0.5:  # 30% are popular
            booking_rate = 0.7
        else:  # 50% are average
            booking_rate = 0.4
        
        num_bookings = min(
            int(instance.template.capacity * booking_rate),
            len(students)
        )
        
        # Select random students for this class
        class_students = sample(students, num_bookings)
        
        for student in class_students:
            # Determine booking status
            if instance.start_datetime.date() < today:
                # Past classes - mostly completed, some no-shows
                status = choice([
                    BookingStatus.COMPLETED, BookingStatus.COMPLETED, BookingStatus.COMPLETED,
                    BookingStatus.NO_SHOW, BookingStatus.CANCELLED
                ])
            elif instance.start_datetime.date() == today:
                # Today's classes - mostly confirmed
                status = BookingStatus.CONFIRMED
            else:
                # Future classes - mostly confirmed, some cancelled
                if random() < 0.95:
                    status = BookingStatus.CONFIRMED
                else:
                    status = BookingStatus.CANCELLED
            
            booking_date = instance.start_datetime - timedelta(
                days=randint(1, 14), 
                hours=randint(0, 23)
            )
            
            booking = Booking(
                user_id=student.id,
                class_instance_id=instance.id,
                status=status,
                booking_date=booking_date,
            )
            
            # Add cancellation details if cancelled
            if status == BookingStatus.CANCELLED:
                booking.cancellation_date = booking_date + timedelta(
                    hours=randint(1, 48)
                )
            
            bookings.append(booking)
            session.add(booking)
            
            # Commit in batches
            if len(bookings) % 200 == 199:
                await session.commit()
    
    await session.commit()
    return bookings


async def create_social_networks(session: AsyncSession, students: List[User]):
    """Create realistic social connections between users."""
    friendships = []
    
    # Create friend networks - each student has 0-10 friends
    for student in sample(students, int(len(students) * 0.6)):  # 60% have friends
        num_friends = randint(1, 10)
        potential_friends = [s for s in students if s.id != student.id]
        friends = sample(potential_friends, min(num_friends, len(potential_friends)))
        
        for friend in friends:
            # Avoid duplicate friendships
            existing = any(
                f.user_id == student.id and f.friend_id == friend.id or
                f.user_id == friend.id and f.friend_id == student.id
                for f in friendships
            )
            
            if not existing:
                # Determine friendship status
                rand = random()
                if rand < 0.7:  # 70% accepted
                    status = FriendshipStatus.ACCEPTED
                    requested_at = datetime.now() - timedelta(days=randint(1, 365))
                    accepted_at = requested_at + timedelta(hours=randint(1, 168))
                elif rand < 0.9:  # 20% pending
                    status = FriendshipStatus.PENDING
                    requested_at = datetime.now() - timedelta(days=randint(1, 30))
                    accepted_at = None
                else:  # 10% blocked
                    status = FriendshipStatus.BLOCKED
                    requested_at = datetime.now() - timedelta(days=randint(30, 365))
                    accepted_at = None
                
                friendship = Friendship(
                    user_id=student.id,
                    friend_id=friend.id,
                    status=status,
                    requested_at=requested_at,
                    accepted_at=accepted_at,
                )
                
                friendships.append(friendship)
                session.add(friendship)
                
                # Commit in batches
                if len(friendships) % 100 == 99:
                    await session.commit()
    
    await session.commit()
    return friendships


async def create_payment_history(session: AsyncSession, students: List[User], packages: List[Package]):
    """Create comprehensive payment history."""
    payments = []
    
    # Create payments for 70% of students
    paying_students = sample(students, int(len(students) * 0.7))
    
    for student in paying_students:
        # Each student has 1-5 payment records
        num_payments = randint(1, 5)
        
        for _ in range(num_payments):
            package = choice([p for p in packages if p.is_active])
            
            # Payment timing
            days_ago = randint(1, 365)
            payment_date = datetime.now() - timedelta(days=days_ago)
            
            # Payment method distribution
            method_rand = random()
            if method_rand < 0.6:  # 60% credit card/stripe
                payment_method = choice([PaymentMethod.CREDIT_CARD, PaymentMethod.STRIPE])
                external_id = f"pi_{randint(1000000000, 9999999999)}"
            elif method_rand < 0.8:  # 20% cash
                payment_method = PaymentMethod.CASH
                external_id = None
            else:  # 20% other methods
                payment_method = choice([PaymentMethod.BANK_TRANSFER, PaymentMethod.PAYPAL])
                external_id = f"txn_{randint(100000, 999999)}"
            
            # Payment status distribution
            status_rand = random()
            if status_rand < 0.85:  # 85% completed
                status = PaymentStatus.COMPLETED
            elif status_rand < 0.95:  # 10% pending
                status = PaymentStatus.PENDING
            else:  # 5% failed
                status = choice([PaymentStatus.FAILED, PaymentStatus.CANCELLED])
            
            payment = Payment(
                user_id=student.id,
                package_id=package.id,
                amount=float(package.price),
                payment_type=PaymentType.PACKAGE_PURCHASE,
                payment_method=payment_method,
                status=status,
                payment_date=payment_date if status == PaymentStatus.COMPLETED else None,
                external_transaction_id=external_id,
                description=f"{package.name} Purchase",
            )
            
            payments.append(payment)
            session.add(payment)
            
            # Commit in batches
            if len(payments) % 100 == 99:
                await session.commit()
    
    await session.commit()
    return payments


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


async def seed_heavy():
    """Heavy seeding - extensive data for performance and load testing."""
    print("[SEED] Starting heavy database seeding...")
    print("[WARN] This will create a large dataset - may take several minutes")

    await init_db()

    async with AsyncSessionLocal() as session:
        # Clear existing data first
        await clear_existing_data(session)
        
        print("[INFO] Creating admin users...")
        admins = await create_admin_users(session)
        
        print("[INFO] Creating instructors...")
        instructors = await create_instructors(session, count=12)
        
        print("[INFO] Creating students (this may take a while)...")
        students = await create_students(session, count=200)
        
        print("[INFO] Creating comprehensive packages...")
        packages = await create_comprehensive_packages(session)
        
        print("[INFO] Creating diverse class templates...")
        templates = await create_diverse_class_templates(session, instructors)
        
        print("[INFO] Creating extensive class instances...")
        instances = await create_extensive_class_instances(session, instructors, templates, weeks=8)
        
        print("[INFO] Creating user packages in bulk...")
        await create_user_packages_bulk(session, students, packages, admins)
        
        print("[INFO] Creating bulk bookings...")
        await create_bulk_bookings(session, students, instances)
        
        print("[INFO] Creating social networks...")
        await create_social_networks(session, students)
        
        print("[INFO] Creating payment history...")
        await create_payment_history(session, students, packages)

    print("[SUCCESS] Heavy seeding completed!")
    print("[STATS] Final Statistics:")
    print(f"  - {len(admins)} admins")
    print(f"  - {len(instructors)} instructors") 
    print(f"  - {len(students)} students")
    print(f"  - {len(packages)} packages")
    print(f"  - {len(templates)} class templates")
    print(f"  - {len(instances)} class instances (8 weeks)")
    print("  - Hundreds of user packages with various statuses")
    print("  - Thousands of bookings across all classes")
    print("  - Complex social networks and friendships")
    print("  - Comprehensive payment history")
    print("\n[READY] Database ready for performance testing!")


if __name__ == "__main__":
    asyncio.run(seed_heavy())