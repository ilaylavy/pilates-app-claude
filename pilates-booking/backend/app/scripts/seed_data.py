#!/usr/bin/env python3
"""
Seed script to populate the database with initial data.
"""
import asyncio
import os
import sys
from datetime import datetime, time, timedelta

# Add parent directory to path
sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.class_schedule import (ClassInstance, ClassLevel, ClassStatus,
                                       ClassTemplate, WeekDay)
from app.models.package import Package
from app.models.user import User, UserRole


async def create_users(session: AsyncSession):
    """Create initial users."""
    print("Creating users...")

    # Admin user
    admin = User(
        email="admin@pilates.com",
        hashed_password=get_password_hash("admin123"),
        first_name="Admin",
        last_name="User",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    session.add(admin)

    # Instructor
    instructor = User(
        email="instructor@pilates.com",
        hashed_password=get_password_hash("instructor123"),
        first_name="Sarah",
        last_name="Johnson",
        phone="+1234567890",
        role=UserRole.INSTRUCTOR,
        is_active=True,
        is_verified=True,
    )
    session.add(instructor)

    # Student
    student = User(
        email="student@pilates.com",
        hashed_password=get_password_hash("student123"),
        first_name="John",
        last_name="Doe",
        phone="+1987654321",
        role=UserRole.STUDENT,
        is_active=True,
        is_verified=True,
    )
    session.add(student)

    await session.commit()
    print("Users created successfully!")

    return admin, instructor, student


async def create_packages(session: AsyncSession):
    """Create initial packages."""
    print("Creating packages...")

    packages = [
        Package(
            name="Single Class",
            description="Drop-in class for new students",
            credits=1,
            price=25.00,
            validity_days=7,
            is_active=True,
        ),
        Package(
            name="5-Class Package",
            description="Great for regular practitioners",
            credits=5,
            price=110.00,
            validity_days=60,
            is_active=True,
        ),
        Package(
            name="10-Class Package",
            description="Best value for committed students",
            credits=10,
            price=200.00,
            validity_days=90,
            is_active=True,
        ),
        Package(
            name="Monthly Unlimited",
            description="Unlimited classes for one month",
            credits=999,  # High number for unlimited
            price=150.00,
            validity_days=30,
            is_unlimited=True,
            is_active=True,
        ),
    ]

    for package in packages:
        session.add(package)

    await session.commit()
    print("Packages created successfully!")


async def create_class_templates(session: AsyncSession):
    """Create initial class templates."""
    print("Creating class templates...")

    templates = [
        ClassTemplate(
            name="Morning Flow",
            description="Start your day with a gentle pilates flow",
            duration_minutes=60,
            capacity=12,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.MONDAY,
            start_time=time(8, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="Beginner Basics",
            description="Perfect for those new to Pilates",
            duration_minutes=45,
            capacity=8,
            level=ClassLevel.BEGINNER,
            day_of_week=WeekDay.TUESDAY,
            start_time=time(18, 30),
            is_active=True,
        ),
        ClassTemplate(
            name="Power Pilates",
            description="High-intensity Pilates workout",
            duration_minutes=60,
            capacity=10,
            level=ClassLevel.ADVANCED,
            day_of_week=WeekDay.WEDNESDAY,
            start_time=time(19, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="Lunch Break Pilates",
            description="Quick midday session",
            duration_minutes=30,
            capacity=15,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.THURSDAY,
            start_time=time(12, 0),
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
    ]

    for template in templates:
        session.add(template)

    await session.commit()
    print("Class templates created successfully!")

    return templates


async def create_class_instances(
    session: AsyncSession, instructor: User, templates: list
):
    """Create some class instances for the next few weeks."""
    print("Creating class instances...")

    # Get current date and create instances for the next 2 weeks
    today = datetime.now().date()
    start_date = today + timedelta(days=(0 - today.weekday()))  # Start from this Monday

    instances = []
    for week_offset in range(2):  # 2 weeks
        for template in templates:
            # Calculate the date for this template's day of week
            days_ahead = list(WeekDay).index(template.day_of_week)
            class_date = start_date + timedelta(days=days_ahead + (week_offset * 7))

            # Create datetime from date and time
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
    print(f"Created {len(instances)} class instances!")


async def seed_database():
    """Main seeding function."""
    print("Starting database seeding...")

    # Initialize database
    await init_db()

    async with AsyncSessionLocal() as session:
        # Create users
        admin, instructor, student = await create_users(session)

        # Create packages
        await create_packages(session)

        # Create class templates
        templates = await create_class_templates(session)

        # Refresh to get IDs
        await session.refresh(instructor)
        for template in templates:
            await session.refresh(template)

        # Create class instances
        await create_class_instances(session, instructor, templates)

    print("Database seeding completed successfully!")


if __name__ == "__main__":
    asyncio.run(seed_database())
