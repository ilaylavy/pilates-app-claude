#!/usr/bin/env python3
"""
Light seeding script - Minimal data for basic testing.
Creates only essential records for development.
"""
import asyncio
import os
import sys
from datetime import datetime, time, timedelta

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.class_schedule import (ClassInstance, ClassLevel, ClassStatus,
                                       ClassTemplate, WeekDay)
from app.models.package import Package
from app.models.user import User, UserRole


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


async def seed_light():
    """Light seeding - minimal data for basic functionality."""
    print("[SEED] Starting light database seeding...")

    await init_db()

    async with AsyncSessionLocal() as session:
        # Clear existing data first
        await clear_existing_data(session)
        
        # Create minimal users
        users = [
            User(
                email="admin@test.com",
                hashed_password=get_password_hash("admin123"),
                first_name="Admin",
                last_name="User",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            ),
            User(
                email="instructor@test.com",
                hashed_password=get_password_hash("instructor123"),
                first_name="Sarah",
                last_name="Instructor",
                role=UserRole.INSTRUCTOR,
                is_active=True,
                is_verified=True,
            ),
            User(
                email="student@test.com",
                hashed_password=get_password_hash("student123"),
                first_name="John",
                last_name="Student",
                role=UserRole.STUDENT,
                is_active=True,
                is_verified=True,
            ),
        ]

        for user in users:
            session.add(user)
        await session.commit()

        # Create basic packages
        packages = [
            Package(
                name="Single Class",
                description="One-time class pass",
                credits=1,
                price=25.00,
                validity_days=7,
                is_active=True,
            ),
            Package(
                name="5-Class Pack",
                description="Basic package for regulars",
                credits=5,
                price=110.00,
                validity_days=60,
                is_active=True,
            ),
        ]

        for package in packages:
            session.add(package)
        await session.commit()

        # Create basic class template
        template = ClassTemplate(
            name="Morning Flow",
            description="Basic morning class",
            duration_minutes=60,
            capacity=10,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.MONDAY,
            start_time=time(9, 0),
            is_active=True,
        )
        session.add(template)
        await session.commit()

        # Get instructor for class instances
        instructor = next(u for u in users if u.role == UserRole.INSTRUCTOR)
        await session.refresh(instructor)
        await session.refresh(template)

        # Create one week of classes
        today = datetime.now().date()
        start_date = today + timedelta(days=(0 - today.weekday()))

        for week_offset in range(1):  # Only current week
            class_date = start_date + timedelta(days=week_offset * 7)
            start_datetime = datetime.combine(class_date, template.start_time)
            end_datetime = start_datetime + timedelta(minutes=template.duration_minutes)

            instance = ClassInstance(
                template_id=template.id,
                instructor_id=instructor.id,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
                status=ClassStatus.SCHEDULED,
                notes="Light seed - Week 1",
            )
            session.add(instance)

        await session.commit()

    print("[SUCCESS] Light seeding completed!")
    print("[STATS] Created: 3 users, 2 packages, 1 template, 1 class instance")


if __name__ == "__main__":
    asyncio.run(seed_light())