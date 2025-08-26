#!/usr/bin/env python3
"""
Hebrew seeding script to populate the database with Hebrew content.
This is useful for testing the Hebrew internationalization (i18n) implementation.
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
from app.models.announcement import Announcement
from app.models.class_schedule import (ClassInstance, ClassLevel, ClassStatus,
                                       ClassTemplate, WeekDay)
from app.models.package import Package
from app.models.user import User, UserRole


async def create_hebrew_users(session: AsyncSession):
    """Create initial users with Hebrew names."""
    print("יוצר משתמשים בעברית...")

    # Admin user
    admin = User(
        email="admin@pilates.co.il",
        hashed_password=get_password_hash("admin123"),
        first_name="דני",
        last_name="כהן",
        role=UserRole.ADMIN,
        is_active=True,
        is_verified=True,
    )
    session.add(admin)

    # Instructor 1
    instructor1 = User(
        email="maya@pilates.co.il",
        hashed_password=get_password_hash("instructor123"),
        first_name="מיה",
        last_name="לוי",
        phone="+972501234567",
        role=UserRole.INSTRUCTOR,
        is_active=True,
        is_verified=True,
    )
    session.add(instructor1)

    # Instructor 2
    instructor2 = User(
        email="tal@pilates.co.il",
        hashed_password=get_password_hash("instructor123"),
        first_name="טל",
        last_name="ברק",
        phone="+972507654321",
        role=UserRole.INSTRUCTOR,
        is_active=True,
        is_verified=True,
    )
    session.add(instructor2)

    # Students
    students = [
        User(
            email="noa@example.co.il",
            hashed_password=get_password_hash("student123"),
            first_name="נועה",
            last_name="שמש",
            phone="+972501111111",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="amit@example.co.il",
            hashed_password=get_password_hash("student123"),
            first_name="עמית",
            last_name="ארז",
            phone="+972502222222",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="shira@example.co.il",
            hashed_password=get_password_hash("student123"),
            first_name="שירה",
            last_name="מור",
            phone="+972503333333",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="yoni@example.co.il",
            hashed_password=get_password_hash("student123"),
            first_name="יוני",
            last_name="דוד",
            phone="+972504444444",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="rachel@example.co.il",
            hashed_password=get_password_hash("student123"),
            first_name="רחל",
            last_name="אברהם",
            phone="+972505555555",
            role=UserRole.STUDENT,
            is_active=True,
            is_verified=True,
        ),
    ]

    for student in students:
        session.add(student)

    await session.commit()
    print("משתמשים נוצרו בהצלחה!")

    return admin, instructor1, instructor2, students


async def create_hebrew_packages(session: AsyncSession):
    """Create packages with Hebrew names and descriptions."""
    print("יוצר חבילות בעברית...")

    packages = [
        Package(
            name="שיעור יחיד",
            description="שיעור בודד למתחילים - מושלם לטעימה ראשונה",
            credits=1,
            price=80.00,
            validity_days=7,
            is_active=True,
        ),
        Package(
            name="חבילת 5 שיעורים",
            description="חבילה מושלמת למתרגלים קבועים - חסכון של 15%",
            credits=5,
            price=340.00,
            validity_days=60,
            is_active=True,
        ),
        Package(
            name="חבילת 10 שיעורים",
            description="הערך הטוב ביותר לתלמידים מחויבים - חסכון של 25%",
            credits=10,
            price=600.00,
            validity_days=90,
            is_active=True,
        ),
        Package(
            name="מנוי חודשי ללא הגבלה",
            description="שיעורים ללא הגבלה לחודש אחד - מושלם לחובבי פילאטס",
            credits=999,
            price=450.00,
            validity_days=30,
            is_unlimited=True,
            is_active=True,
        ),
        Package(
            name="חבילת סטודנטים",
            description="מחיר מוזל לסטודנטים - נדרש אישור לימודים",
            credits=8,
            price=480.00,
            validity_days=75,
            is_active=True,
        ),
        Package(
            name="מנוי שנתי VIP",
            description="מנוי שנתי עם הטבות מיוחדות - עדיפות בהזמנות",
            credits=999,
            price=4800.00,
            validity_days=365,
            is_unlimited=True,
            is_active=True,
        ),
    ]

    for package in packages:
        session.add(package)

    await session.commit()
    print("חבילות נוצרו בהצלחה!")


async def create_hebrew_class_templates(session: AsyncSession):
    """Create class templates with Hebrew names and descriptions."""
    print("יוצר תבניות שיעורים בעברית...")

    templates = [
        ClassTemplate(
            name="פילאטס בוקר",
            description="התחילו את היום עם אימון פילאטס עדין ומחזק",
            duration_minutes=60,
            capacity=12,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.SUNDAY,
            start_time=time(8, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="יסודות למתחילים",
            description="שיעור מושלם לאלו שמתחילים בפילאטס - נלמד את הבסיס",
            duration_minutes=45,
            capacity=8,
            level=ClassLevel.BEGINNER,
            day_of_week=WeekDay.MONDAY,
            start_time=time(17, 30),
            is_active=True,
        ),
        ClassTemplate(
            name="פילאטס כוח",
            description="אימון פילאטס אינטנסיבי לחיזוק השרירים העמוקים",
            duration_minutes=60,
            capacity=10,
            level=ClassLevel.ADVANCED,
            day_of_week=WeekDay.TUESDAY,
            start_time=time(19, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="הפסקת צהריים פעילה",
            description="שיעור קצר ואפקטיבי באמצע היום",
            duration_minutes=30,
            capacity=15,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.WEDNESDAY,
            start_time=time(12, 30),
            is_active=True,
        ),
        ClassTemplate(
            name="פילאטס ערב",
            description="שיעור מרגיע לסיום היום - מושלם אחרי העבודה",
            duration_minutes=50,
            capacity=14,
            level=ClassLevel.INTERMEDIATE,
            day_of_week=WeekDay.THURSDAY,
            start_time=time(18, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="חלל ליבה",
            description="התמקדות על חיזוק שרירי הבטן והגב התחתון",
            duration_minutes=45,
            capacity=12,
            level=ClassLevel.INTERMEDIATE,
            day_of_week=WeekDay.THURSDAY,
            start_time=time(19, 30),
            is_active=True,
        ),
        ClassTemplate(
            name="סוף שבוע אקטיבי",
            description="שיעור אנרגטי לסוף השבוע - בואו נתחיל נכון",
            duration_minutes=75,
            capacity=16,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.FRIDAY,
            start_time=time(9, 30),
            is_active=True,
        ),
        ClassTemplate(
            name="פילאטס משקם",
            description="שיעור עדין למי שחוזר מפציעה או מחפש תרגול רך",
            duration_minutes=50,
            capacity=8,
            level=ClassLevel.BEGINNER,
            day_of_week=WeekDay.FRIDAY,
            start_time=time(11, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="אימון סוף שבוע",
            description="אימון מקיף לסוף השבוע - חיזוק וגמישות",
            duration_minutes=60,
            capacity=12,
            level=ClassLevel.INTERMEDIATE,
            day_of_week=WeekDay.SATURDAY,
            start_time=time(10, 0),
            is_active=True,
        ),
        ClassTemplate(
            name="יוגה-פילאטס",
            description="שילוב של יוגה ופילאטס לאיזון מושלם",
            duration_minutes=65,
            capacity=14,
            level=ClassLevel.ALL_LEVELS,
            day_of_week=WeekDay.SATURDAY,
            start_time=time(11, 30),
            is_active=True,
        ),
    ]

    for template in templates:
        session.add(template)

    await session.commit()
    print("תבניות שיעורים נוצרו בהצלחה!")

    return templates


async def create_hebrew_class_instances(
    session: AsyncSession, instructors: list, templates: list
):
    """Create class instances for the next few weeks with Hebrew notes."""
    print("יוצר מופעי שיעורים...")

    # Get current date and create instances for the next 3 weeks
    today = datetime.now().date()
    # Start from this Sunday (Israel week starts on Sunday)
    days_until_sunday = (6 - today.weekday()) % 7
    start_date = today + timedelta(days=days_until_sunday)

    instances = []
    hebrew_notes = [
        "שיעור מעולה עם דגש על נשימה",
        "נתרכז על יציבה נכונה",
        "אל תשכחו לקחת מגבת ומים",
        "שיעור מתאים לכל הרמות",
        "נעבוד על גמישות והתמדה",
        "שיעור עם מוזיקה מרגיעה",
        "התמקדות על חיזוק הליבה",
        "מומלץ להגיע 10 דקות מוקדם",
        "נלמד תנוחות חדשות השבוע",
        "שיעור אנרגטי ומעצים",
    ]

    for week_offset in range(3):  # 3 weeks
        for template in templates:
            # Calculate the date for this template's day of week
            # WeekDay enum: SUNDAY=0, MONDAY=1, etc.
            days_ahead = list(WeekDay).index(template.day_of_week)
            class_date = start_date + timedelta(days=days_ahead + (week_offset * 7))

            # Skip past dates
            if class_date < today:
                continue

            # Create datetime from date and time
            start_datetime = datetime.combine(class_date, template.start_time)
            end_datetime = start_datetime + timedelta(minutes=template.duration_minutes)

            # Assign instructor cyclically
            instructor = instructors[len(instances) % len(instructors)]

            instance = ClassInstance(
                template_id=template.id,
                instructor_id=instructor.id,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
                status=ClassStatus.SCHEDULED,
                notes=hebrew_notes[len(instances) % len(hebrew_notes)],
            )
            session.add(instance)
            instances.append(instance)

    await session.commit()
    print(f"נוצרו {len(instances)} מופעי שיעורים!")


async def create_hebrew_announcements(session: AsyncSession, admin: User):
    """Create announcements in Hebrew."""
    print("יוצר הודעות בעברית...")

    announcements = [
        Announcement(
            title="ברוכים הבאים לסטודיו החדש!",
            message="אנחנו נרגשים לפתוח את הסטודיו החדש שלנו ולהתחיל את המסע הזה איתכם. בואו נתחיל!",
            type="info",
            target_roles=["student"],
            expires_at=datetime.now() + timedelta(days=30),
            created_by=admin.id,
            is_active=True,
            is_dismissible=True,
        ),
        Announcement(
            title="שיעורים חדשים בתוכנית!",
            message="הוספנו שיעורי פילאטס-יוגה חדשים לתוכנית השבועית. השיעורים מתקיימים בימי שבת בשעות 11:30. מושלם לסוף השבוع!",
            type="success",
            target_roles=["student"],
            expires_at=datetime.now() + timedelta(days=14),
            created_by=admin.id,
            is_active=True,
            is_dismissible=True,
        ),
        Announcement(
            title="הנחה מיוחדת לחודש זה!",
            message="קבלו 20% הנחה על כל החבילות החדשות עד סוף החודש. השתמשו בקוד PILATES20 בעת ההזמנה.",
            type="warning",
            target_roles=["student"],
            expires_at=datetime.now() + timedelta(days=25),
            created_by=admin.id,
            is_active=True,
            is_dismissible=True,
        ),
        Announcement(
            title="שינוי שעות לשיעור חלל ליבה",
            message="החל מהשבוע הבא, שיעור חלל ליבה בימי חמישי יעבור משעה 19:30 ל-20:00. אנא התאימו את לוחות הזמנים שלכם.",
            type="info",
            target_roles=["student", "instructor"],
            expires_at=datetime.now() + timedelta(days=7),
            created_by=admin.id,
            is_active=True,
            is_dismissible=True,
        ),
        Announcement(
            title="הודעה למדריכים - ישיבה חודשית",
            message="תזכורת לישיבת המדריכים החודשית ביום ראשון הקרוב בשעה 14:00. נדון על השינויים החדשים בתוכנית וטכניקות חדשות.",
            type="info",
            target_roles=["instructor", "admin"],
            expires_at=datetime.now() + timedelta(days=5),
            created_by=admin.id,
            is_active=True,
            is_dismissible=False,
        ),
    ]

    for announcement in announcements:
        session.add(announcement)

    await session.commit()
    print("הודעות נוצרו בהצלחה!")


async def seed_hebrew_database():
    """Main Hebrew seeding function."""
    print("מתחיל זריעת מסד נתונים בעברית...")
    print("=" * 50)

    # Initialize database
    await init_db()

    async with AsyncSessionLocal() as session:
        # Create users
        admin, instructor1, instructor2, students = await create_hebrew_users(session)

        # Create packages
        await create_hebrew_packages(session)

        # Create class templates
        templates = await create_hebrew_class_templates(session)

        # Refresh to get IDs
        await session.refresh(instructor1)
        await session.refresh(instructor2)
        for template in templates:
            await session.refresh(template)

        # Create class instances with both instructors
        instructors = [instructor1, instructor2]
        await create_hebrew_class_instances(session, instructors, templates)
        
        # Create Hebrew announcements
        await session.refresh(admin)
        await create_hebrew_announcements(session, admin)

    print("=" * 50)
    print("זריעת מסד הנתונים הושלמה בהצלחה!")
    print(f"נוצרו: {3 + len(students)} משתמשים, 6 חבילות, {len(templates)} תבניות שיעורים, מופעי שיעורים ו-5 הודעות")
    print("=" * 50)
    print("\nפרטי התחברות:")
    print("מנהל: admin@pilates.co.il / admin123")
    print("מדריכה 1: maya@pilates.co.il / instructor123")
    print("מדריך 2: tal@pilates.co.il / instructor123") 
    print("תלמידים: noa@example.co.il / student123 (ועוד)")
    print("=" * 50)


if __name__ == "__main__":
    asyncio.run(seed_hebrew_database())