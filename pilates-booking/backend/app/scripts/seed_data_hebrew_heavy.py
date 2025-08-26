#!/usr/bin/env python3
"""
Heavy Hebrew seeding script - Comprehensive Hebrew dataset with historical data.
Creates extensive Hebrew content going back 2 months for realistic i18n testing.
"""
import asyncio
import os
import sys
from datetime import datetime, time, timedelta, timezone
from random import choice, randint, random, sample
from typing import List

sys.path.append(
    os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
)

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import AsyncSessionLocal, init_db
from app.core.security import get_password_hash
from app.models.announcement import Announcement
from app.models.booking import Booking, BookingStatus, WaitlistEntry
from app.models.class_schedule import (ClassInstance, ClassLevel, ClassStatus,
                                       ClassTemplate, WeekDay)
from app.models.friendship import Friendship, FriendshipStatus
from app.models.package import (Package, UserPackage,
                                 UserPackageStatus, PaymentStatus as PackagePaymentStatus,
                                 PaymentMethod as PackagePaymentMethod)  
from app.models.payment import Payment, PaymentMethod, PaymentType, PaymentStatus
from app.models.user import User, UserRole


# Hebrew sample data for realistic names and content
HEBREW_FIRST_NAMES_FEMALE = [
    "נועה", "תמר", "שירה", "מיה", "רונית", "דנה", "עינת", "יעל", "מור", "לירון",
    "רחל", "שרה", "רבקה", "לאה", "מרים", "אסתר", "רות", "נעמי", "אביגיל", "חנה",
    "תהילה", "אורית", "מיכל", "גילה", "ציפורה", "בת-שבע", "דבורה", "הדר", "אילנה", "נטלי",
    "אלונה", "כרמית", "סיגלית", "ורד", "יסמין", "שושנה", "אירית", "דליה", "ענת", "זהבה",
    "שלומית", "מזל", "סימה", "טובה", "פנינה", "אביבה", "ניצה", "צופיה", "אלישבע", "יהודית"
]

HEBREW_FIRST_NAMES_MALE = [
    "עמית", "יונתן", "דניאל", "אליעזר", "משה", "דוד", "שלמה", "יוסף", "אברהם", "יצחק",
    "יעקב", "אהרון", "נחמן", "עזרא", "נחום", "אביחי", "גלעד", "רועי", "איתמר", "אלון",
    "רן", "עידו", "טל", "גיא", "עומר", "נדב", "אוריה", "אמיר", "רוני", "דרור",
    "יואב", "אסף", "איתן", "נתן", "עמוס", "גדעון", "בועז", "אלעד", "יהונתן", "מיכאל",
    "רפאל", "גבריאל", "עזריאל", "שמואל", "בנימין", "לוי", "יהודה", "ראובן", "שמעון", "זבולון"
]

HEBREW_LAST_NAMES = [
    "כהן", "לוי", "שמש", "ארז", "מור", "דוד", "אברהם", "יצחק", "יעקב", "רוזן",
    "גולד", "שטרן", "פרידמן", "זילבר", "פרל", "רוביץ", "שפירא", "וייס", "שוורץ", "גרין",
    "ברק", "צור", "אבן", "סלע", "הר", "שדה", "יער", "נחל", "גל", "דן",
    "בן-דוד", "בר-לב", "אבן-חן", "חן", "טוב", "נור", "אור", "בהיר", "זוהר", "רם",
    "גבוה", "חזק", "אמיץ", "גיבור", "מלך", "נסיך", "שר", "חכם", "נבון", "ישר"
]

HEBREW_CLASS_NAMES = [
    "פילאטס בוקר זהוב", "כוח הליבה", "יסודות בעברית", "אימון ערב", "זרימה חלקה",
    "חיזוק עמוק", "גמישות וכוח", "שקיעה רגועה", "אתגר מתקדמים", "נשימה ותנועה",
    "האופי הישראלי", "כושר צבאי", "יוגה-פילאטס", "כושר לאמהות", "שחזור פעיל",
    "אימון קרבי", "ליבה ברזל", "נוער פעיל", "זקנים חזקים", "הריון בטוח",
    "מתים עומד", "כדור כוח", "גומיות אימון", "משקולות קלות", "מזרן מושלם"
]

HEBREW_CLASS_DESCRIPTIONS = [
    "תחילת יום מושלמת עם תרגילי פילאטס מעוררי אנרגיה",
    "אימון אינטנסיבי לחיזוק שרירי הליבה העמוקים",
    "מבוא מקיף ליסודות הפילאטס בהדרכה בעברית",
    "סיום יום פעיל עם תרגילים מרגיעים ומחזקים",
    "זרימת תנועות חלקה ורצופה לגמישות ושיווי משקל",
    "אימון עמוק לחיזוק השרירים הפנימיים",
    "שילוב מושלם של תרגילי גמישות וחיזוק",
    "אימון רגוע בסוף היום לשחרור מתחים",
    "אתגר מתקדמים עם תרגילים מורכבים",
    "התמקדות על נשימה נכונה ותנועה זורמת",
    "אימון בסגנון ישראלי עם מוזיקה מקומית",
    "אימון בהשראת הכושר הצבאי הישראלי",
    "שילוב יוגה ופילאטס למפגש הרמוני",
    "אימון מותאם לאמהות חדשות וותיקות",
    "שחזור אקטיבי לאחר פציעות או בעיות גב",
]

HEBREW_PACKAGE_NAMES = [
    "שיעור ניסיון", "כניסה בודדת", "חבילת התחלה", "מנוי שבועי", "חבילת החודש",
    "מנוי רבעוני", "מנוי חצי שנתי", "מנוי שנתי", "חבילת משפחה", "מנוי סטודנטים",
    "חבילת זהב", "מנוי פלטינום", "חבילת וי.איי.פי", "מנוי בוקר", "מנוי ערב",
    "חבילת סוף שבוע", "מנוי אמהות", "חבילת גמלאים", "מנוי צבאי", "חבילת קבוצות"
]

HEBREW_ANNOUNCEMENTS = [
    {
        "title": "ברוכים הבאים לעונה החדשה!",
        "message": "אנחנו שמחים לפתוח את העונה החדשה עם תוכנית מרגשת ומגוונת של שיעורי פילאטס. בואו להצטרף אלינו למסע של חיזוק הגוף והנפש!",
        "type": "info"
    },
    {
        "title": "שיעורים חדשים בתוכנית השבועית",
        "message": "הוספנו שיעורי יוגה-פילאטס חדשים בימי שלישי וחמישי בשעה 19:30. השיעורים מתאימים לכל הרמות ומשלבים את הטוב משני העולמות.",
        "type": "success"
    },
    {
        "title": "הנחה מיוחדת לחודש אלול!",
        "message": "לקראת חודש אלול, אנחנו מציעים הנחה של 25% על כל החבילות החדשות. זמן מושלם להתחיל את השנה החדשה בכושר!",
        "type": "warning"
    },
    {
        "title": "סגירת הסטודיו בחגי תשרי",
        "message": "הסטודיו יהיה סגור בראש השנה, יום כיפור וסוכות. השיעורים יחזרו לפעילות מלאה לאחר החגים. חג שמח לכולם!",
        "type": "info"
    },
    {
        "title": "מדריכה חדשה מצטרפת לצוות!",
        "message": "אנחנו גאים להכיר את רונית כהן, המדריכה החדשה שלנו. רונית מביאה איתה 8 שנות נסיון בפילאטס ויוגה. בואו להכיר אותה בשיעוריה החדשים!",
        "type": "success"
    }
]

HEBREW_CITIES = ["תל אביב", "ירושלים", "חיפה", "באר שבע", "נתניה", "רמת גן", "פתח תקווה", "אשדוד", "ראשון לציון", "הרצליה"]


async def create_hebrew_admin_users(session: AsyncSession) -> List[User]:
    """Create Hebrew admin and system users."""
    print("יוצר משתמשי מנהל בעברית...")
    
    admins = [
        User(
            email="admin@pilates.co.il",
            hashed_password=get_password_hash("admin123"),
            first_name="דני",
            last_name="כהן",
            role=UserRole.ADMIN,
            is_active=True,
            is_verified=True,
        ),
        User(
            email="manager@pilates.co.il",
            hashed_password=get_password_hash("manager123"),
            first_name="מיכל",
            last_name="לוי",
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
    
    print(f"נוצרו {len(admins)} מנהלים")
    return admins


async def create_hebrew_instructors(session: AsyncSession, count: int = 15) -> List[User]:
    """Create Hebrew instructors with diverse profiles."""
    print("יוצר מדריכים בעברית...")
    
    instructors = []
    
    for i in range(count):
        # Mix of male and female names
        if random() > 0.3:  # 70% female instructors
            first_name = choice(HEBREW_FIRST_NAMES_FEMALE)
        else:
            first_name = choice(HEBREW_FIRST_NAMES_MALE)
        
        last_name = choice(HEBREW_LAST_NAMES)
        email = f"instructor{i+1}@pilates.co.il"
        
        instructor = User(
            email=email,
            hashed_password=get_password_hash("instructor123"),
            first_name=first_name,
            last_name=last_name,
            phone=f"+97250{1000+i:04d}",
            role=UserRole.INSTRUCTOR,
            is_active=True,
            is_verified=True,
        )
        instructors.append(instructor)
        session.add(instructor)
    
    await session.commit()
    
    for instructor in instructors:
        await session.refresh(instructor)
    
    print(f"נוצרו {len(instructors)} מדריכים")
    return instructors


async def create_hebrew_students(session: AsyncSession, count: int = 150) -> List[User]:
    """Create Hebrew student users."""
    print("יוצר תלמידים בעברית...")
    
    students = []
    
    for i in range(count):
        # Mix of male and female names
        if random() > 0.4:  # 60% female students
            first_name = choice(HEBREW_FIRST_NAMES_FEMALE)
        else:
            first_name = choice(HEBREW_FIRST_NAMES_MALE)
        
        last_name = choice(HEBREW_LAST_NAMES)
        city = choice(HEBREW_CITIES)
        email = f"student{i+1}@pilates.co.il"
        
        # Some users might not be verified or active
        is_verified = random() > 0.08  # 92% verified
        is_active = random() > 0.03   # 97% active
        
        student = User(
            email=email,
            hashed_password=get_password_hash("student123"),
            first_name=first_name,
            last_name=last_name,
            phone=f"+97250{2000+i:04d}" if random() > 0.25 else None,  # 75% have phone
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
    
    print(f"נוצרו {len(students)} תלמידים")
    return students


async def create_hebrew_comprehensive_packages(session: AsyncSession) -> List[Package]:
    """Create comprehensive Hebrew packages."""
    print("יוצר חבילות מקיפות בעברית...")
    
    packages = [
        # Basic packages
        Package(
            name="שיעור ניסיון",
            description="מיוחד למבקרים לראשונה - בואו להכיר את הסטודיו!",
            credits=1,
            price=50.00,
            validity_days=7,
            is_active=True,
            order_index=1,
        ),
        Package(
            name="כניסה בודדת",
            description="שיעור בודד ללא התחייבות - גמישות מלאה",
            credits=1,
            price=80.00,
            validity_days=7,
            is_active=True,
            order_index=2,
        ),
        
        # Multi-class packages
        Package(
            name="חבילת התחלה - 3 שיעורים",
            description="מושלם לטעימה מכמה סוגי שיעורים שונים",
            credits=3,
            price=210.00,
            validity_days=30,
            is_active=True,
            order_index=3,
        ),
        Package(
            name="חבילת 5 שיעורים",
            description="הבחירה הפופולרית של המתרגלים הקבועים",
            credits=5,
            price=340.00,
            validity_days=60,
            is_active=True,
            order_index=4,
            is_featured=True,
        ),
        Package(
            name="חבילת 10 שיעורים",
            description="הערך הטוב ביותר - חסכון של 25% + גמישות מקסימלית",
            credits=10,
            price=600.00,
            validity_days=90,
            is_active=True,
            order_index=5,
            is_featured=True,
        ),
        Package(
            name="חבילת 20 שיעורים MEGA",
            description="לחובבי הפילאטס האמיתיים - חסכון מקסימלי!",
            credits=20,
            price=1100.00,
            validity_days=120,
            is_active=True,
            order_index=6,
        ),
        
        # Unlimited packages
        Package(
            name="מנוי שבועי ללא הגבלה",
            description="שבוע מלא של פילאטס - אידיאלי לחופשות",
            credits=999,
            price=280.00,
            validity_days=7,
            is_unlimited=True,
            is_active=True,
            order_index=7,
        ),
        Package(
            name="מנוי חודשי ללא הגבלה",
            description="חודש מלא של פילאטס - מושלם למתרגלים יומיים",
            credits=999,
            price=650.00,
            validity_days=30,
            is_unlimited=True,
            is_active=True,
            order_index=8,
            is_featured=True,
        ),
        Package(
            name="מנוי רבעוני ללא הגבלה",
            description="3 חודשים של פילאטס ללא הגבלה - חסכון משמעותי",
            credits=999,
            price=1700.00,
            validity_days=90,
            is_unlimited=True,
            is_active=True,
            order_index=9,
        ),
        Package(
            name="מנוי שנתי VIP",
            description="מנוי שנתי עם עדיפות הזמנות והנחות מיוחדות",
            credits=999,
            price=5500.00,
            validity_days=365,
            is_unlimited=True,
            is_active=True,
            order_index=10,
        ),
        
        # Special packages
        Package(
            name="חבילת סטודנטים",
            description="מחיר מוזל לסטודנטים עם תעודת סטודנט בתוקף",
            credits=8,
            price=480.00,
            validity_days=75,
            is_active=True,
            order_index=11,
        ),
        Package(
            name="חבילת גמלאים",
            description="הנחה מיוחדת לגמלאים - בריאות בגיל הזהוב",
            credits=6,
            price=300.00,
            validity_days=60,
            is_active=True,
            order_index=12,
        ),
        Package(
            name="חבילת משפחה",
            description="חבילה משפחתית ל-2 בני משפחה - בואו להתאמן יחד!",
            credits=15,
            price=900.00,
            validity_days=90,
            is_active=True,
            order_index=13,
        ),
        
        # Inactive/promotional packages
        Package(
            name="חבילת שנה חדשה (לא פעיל)",
            description="מבצע מיוחד לשנה האזרחית החדשה",
            credits=12,
            price=650.00,
            validity_days=90,
            is_active=False,
            order_index=14,
        ),
    ]

    for package in packages:
        session.add(package)

    await session.commit()
    
    for package in packages:
        await session.refresh(package)
    
    print(f"נוצרו {len(packages)} חבילות")
    return packages


async def create_hebrew_class_templates(session: AsyncSession, instructors: List[User]) -> List[ClassTemplate]:
    """Create comprehensive Hebrew class templates."""
    print("יוצר תבניות שיעורים בעברית...")
    
    templates = []
    days = list(WeekDay)
    times = [
        time(6, 30), time(7, 30), time(8, 30), time(9, 30), time(10, 30),
        time(12, 0), time(13, 0), time(17, 0), time(18, 0), time(19, 0),
        time(19, 30), time(20, 0), time(20, 30)
    ]
    levels = list(ClassLevel)
    
    # Create diverse class schedule
    for day in days:
        # 3-5 classes per day
        day_classes = randint(3, 5)
        day_times = sample(times, day_classes)
        
        for class_time in day_times:
            class_name = choice(HEBREW_CLASS_NAMES)
            description = choice(HEBREW_CLASS_DESCRIPTIONS)
            duration = choice([45, 50, 60, 75, 90])
            capacity = choice([8, 10, 12, 15, 20])
            level = choice(levels)
            
            template = ClassTemplate(
                name=f"{class_name}",
                description=description,
                duration_minutes=duration,
                capacity=capacity,
                level=level,
                day_of_week=day,
                start_time=class_time,
                is_active=True,
            )
            templates.append(template)
            session.add(template)
    
    await session.commit()
    
    for template in templates:
        await session.refresh(template)
    
    print(f"נוצרו {len(templates)} תבניות שיעורים")
    return templates


async def create_historical_class_instances(session: AsyncSession, instructors: List[User], 
                                          templates: List[ClassTemplate]) -> List[ClassInstance]:
    """Create class instances with 2 months of historical data."""
    print("יוצר מופעי שיעורים היסטוריים (חזרה 2 חודשים)...")
    
    instances = []
    today = datetime.now(timezone.utc).date()
    
    # Go back 2 months and create forward for 1 month
    start_date = today - timedelta(days=60)  # 2 months back
    end_date = today + timedelta(days=30)    # 1 month forward
    
    # Calculate number of weeks
    total_days = (end_date - start_date).days
    total_weeks = total_days // 7 + 1
    
    print(f"יוצר שיעורים עבור {total_weeks} שבועות ({start_date} עד {end_date})")
    
    for week_offset in range(total_weeks):
        week_start = start_date + timedelta(days=week_offset * 7)
        
        for template in templates:
            # Calculate the date for this template's day of week
            days_ahead = list(WeekDay).index(template.day_of_week)
            class_date = week_start + timedelta(days=days_ahead)
            
            # Skip if outside our range
            if class_date < start_date or class_date > end_date:
                continue
            
            start_datetime = datetime.combine(class_date, template.start_time)
            end_datetime = start_datetime + timedelta(minutes=template.duration_minutes)
            
            # Assign instructor cyclically but with some variation
            instructor = choice(instructors)
            
            # Determine status based on timing
            if class_date < today:
                # Historical classes - mostly completed, some cancelled
                if random() < 0.92:  # 92% completion rate
                    status = ClassStatus.COMPLETED
                else:
                    status = ClassStatus.CANCELLED
            elif class_date == today:
                status = ClassStatus.SCHEDULED
            else:
                status = ClassStatus.SCHEDULED
            
            # Hebrew notes for variety
            hebrew_notes = [
                "שיעור מעולה עם נוכחות גבוהה",
                "התמקדות על תרגילי נשימה",
                "אל תשכחו מגבת ומים",
                "שיעור עם מוזיקה חדשה",
                "נתרגל תנוחות מאתגרות",
                "מתאים לכל הרמות",
                "שיעור אנרגטי במיוחד",
                "הגיעו 10 דקות מוקדם",
                "נושא השיעור: חיזוק ליבה",
                "תרגילים עם אביזרים"
            ]
            
            instance = ClassInstance(
                template_id=template.id,
                instructor_id=instructor.id,
                start_datetime=start_datetime,
                end_datetime=end_datetime,
                status=status,
                notes=choice(hebrew_notes) if random() > 0.3 else None,
            )
            session.add(instance)
            instances.append(instance)
            
            # Commit in batches
            if len(instances) % 200 == 199:
                await session.commit()
                print(f"התקדמות: נוצרו {len(instances)} מופעי שיעורים...")
    
    await session.commit()
    
    # Refresh in batches
    print("מרענן נתונים...")
    for i in range(0, len(instances), 200):
        batch = instances[i:i+200]
        for instance in batch:
            await session.refresh(instance)
        
        if i % 1000 == 0:
            print(f"רענון: עובד על מופעים {i}-{i+200}")
    
    print(f"נוצרו {len(instances)} מופעי שיעורים בסך הכל")
    return instances


async def create_hebrew_user_packages_bulk(session: AsyncSession, students: List[User], 
                                         packages: List[Package], admins: List[User]):
    """Create user packages with Hebrew-appropriate patterns and proper Payment records first."""
    print("יוצר חבילות משתמשים...")
    
    user_packages = []
    payments = []
    
    # 70% of students have packages (higher rate for Hebrew market)
    students_with_packages = sample(students, int(len(students) * 0.7))
    
    # STEP 1: Create Payment records first
    for i, student in enumerate(students_with_packages):
        # Each student has 1-4 packages (historical and current)
        num_packages = randint(1, 4)
        
        for _ in range(num_packages):
            package = choice([p for p in packages if p.is_active])
            
            # Historical purchase dates (2 months back to now)
            days_ago = randint(1, 60)
            purchase_date = datetime.now(timezone.utc) - timedelta(days=days_ago)
            expiry_date = purchase_date + timedelta(days=package.validity_days)
            
            # Status and payment distribution
            if expiry_date < datetime.now(timezone.utc):
                payment_status = PaymentStatus.COMPLETED
                package_status = UserPackageStatus.EXPIRED
            else:
                # Payment status distribution
                rand = random()
                if rand < 0.92:  # 92% completed payments
                    payment_status = PaymentStatus.COMPLETED
                    package_status = UserPackageStatus.ACTIVE
                elif rand < 0.97:  # 5% pending cash
                    payment_status = PaymentStatus.PENDING
                    package_status = UserPackageStatus.ACTIVE
                else:  # 3% failed/cancelled
                    payment_status = choice([PaymentStatus.FAILED, PaymentStatus.CANCELLED])
                    package_status = UserPackageStatus.CANCELLED
            
            # Choose payment method
            payment_method_distribution = random()
            if payment_method_distribution < 0.75:  # 75% credit card
                payment_method = PaymentMethod.CREDIT_CARD
                legacy_payment_method = PackagePaymentMethod.CREDIT_CARD
            elif payment_method_distribution < 0.95:  # 20% cash
                payment_method = PaymentMethod.CASH
                legacy_payment_method = PackagePaymentMethod.CASH
            else:  # 5% other
                payment_method = PaymentMethod.STRIPE
                legacy_payment_method = PackagePaymentMethod.STRIPE
            
            # Create Payment record
            payment = Payment(
                user_id=student.id,
                package_id=package.id,
                amount=package.price,
                currency="ILS",
                payment_type=PaymentType.PACKAGE_PURCHASE,
                payment_method=payment_method,
                status=payment_status,
                payment_date=purchase_date if payment_status == PaymentStatus.COMPLETED else None,
                description=f"רכישת חבילה: {package.name}",
                external_transaction_id=f"HEB-{randint(100000, 999999)}" if payment_status == PaymentStatus.COMPLETED else None
            )
            
            payments.append(payment)
            session.add(payment)
    
    # Commit payments first to get their IDs
    await session.commit()
    print(f"נוצרו {len(payments)} רשומות תשלום")
    
    # Refresh payment objects to get their IDs
    for payment in payments:
        await session.refresh(payment)
    
    # STEP 2: Create UserPackages with payment references
    payment_index = 0
    for i, student in enumerate(students_with_packages):
        student_payments = [p for p in payments if p.user_id == student.id]
        
        for payment in student_payments:
            package = next(p for p in packages if p.id == payment.package_id)
            
            # Calculate package details from payment
            purchase_date = payment.payment_date or payment.created_at
            expiry_date = purchase_date + timedelta(days=package.validity_days)
            
            # Determine credits based on usage patterns
            if package.is_unlimited:
                credits_remaining = 999
            else:
                # More realistic usage pattern for Hebrew users
                usage_percent = random()
                if expiry_date < datetime.now(timezone.utc):
                    # Expired packages - varied usage
                    credits_remaining = randint(0, max(1, package.credits // 3))
                else:
                    # Active packages - conservative usage
                    credits_remaining = max(0, int(package.credits * (1 - usage_percent * 0.7)))
            
            # Map payment status to package status
            if payment.status == PaymentStatus.COMPLETED:
                if expiry_date < datetime.now(timezone.utc):
                    package_status = UserPackageStatus.EXPIRED
                else:
                    package_status = UserPackageStatus.ACTIVE
                legacy_payment_status = PackagePaymentStatus.CONFIRMED
            elif payment.status == PaymentStatus.PENDING:
                package_status = UserPackageStatus.ACTIVE
                legacy_payment_status = PackagePaymentStatus.PENDING
            else:
                package_status = UserPackageStatus.CANCELLED
                legacy_payment_status = PackagePaymentStatus.REJECTED
            
            # Map payment method for legacy compatibility
            legacy_payment_method_map = {
                PaymentMethod.CASH: PackagePaymentMethod.CASH,
                PaymentMethod.CREDIT_CARD: PackagePaymentMethod.CREDIT_CARD,
                PaymentMethod.STRIPE: PackagePaymentMethod.STRIPE,
                PaymentMethod.BANK_TRANSFER: PackagePaymentMethod.BANK_TRANSFER,
                PaymentMethod.PAYPAL: PackagePaymentMethod.PAYPAL,
            }
            legacy_payment_method = legacy_payment_method_map.get(payment.payment_method, PackagePaymentMethod.CREDIT_CARD)
            
            # Set approval details for confirmed payments
            approved_by = choice(admins).id if payment.status == PaymentStatus.COMPLETED else None
            approved_at = purchase_date + timedelta(hours=randint(1, 48)) if approved_by else None
            
            user_package = UserPackage(
                user_id=student.id,
                package_id=package.id,
                payment_id=payment.id,  # REQUIRED foreign key
                credits_remaining=credits_remaining,
                purchase_date=purchase_date,
                expiry_date=expiry_date,
                status=package_status,
                # Legacy fields for backward compatibility
                payment_method=legacy_payment_method,
                payment_status=legacy_payment_status,
                approved_by=approved_by,
                approved_at=approved_at,
                admin_notes=f"רכישה {purchase_date.strftime('%d/%m/%Y')}" if random() > 0.7 else None,
                payment_reference=f"HEB-{payment.id}-{student.id}",
            )
            
            user_packages.append(user_package)
            session.add(user_package)
        
        # Commit in batches
        if i % 50 == 49:
            await session.commit()
            print(f"התקדמות חבילות: {i+1} מתוך {len(students_with_packages)} משתמשים")
    
    await session.commit()
    
    print(f"נוצרו {len(user_packages)} חבילות משתמשים עם רשומות תשלום")
    return user_packages


async def create_hebrew_bookings_bulk(session: AsyncSession, students: List[User], 
                                    instances: List[ClassInstance], user_packages: List[UserPackage]):
    """Create realistic booking patterns with Hebrew context."""
    print("יוצר הזמנות בתבנית ריאליסטית...")
    
    bookings = []
    waitlist_entries = []
    
    # Filter to students who have packages
    students_with_packages = list(set([up.user_id for up in user_packages]))
    active_students = [s for s in students if s.id in students_with_packages]
    
    # Create bookings for completed and scheduled classes
    for i, instance in enumerate(instances):
        if instance.status not in [ClassStatus.SCHEDULED, ClassStatus.COMPLETED]:
            continue
        
        # Determine booking rate based on class popularity and timing
        base_rate = 0.6  # 60% base booking rate
        
        # Adjust rate based on day and time
        if instance.start_datetime.weekday() in [5, 6]:  # Friday, Saturday
            base_rate *= 1.2  # Higher weekend demand
        
        hour = instance.start_datetime.hour
        if 8 <= hour <= 10 or 17 <= hour <= 19:  # Popular times
            base_rate *= 1.3
        elif hour < 7 or hour > 20:  # Off-peak times
            base_rate *= 0.7
        
        # Calculate number of bookings (not exceeding capacity)
        max_bookings = min(instance.template.capacity, len(active_students))
        num_bookings = min(max_bookings, int(max_bookings * min(base_rate, 1.0)))
        
        # Select students for this class
        class_students = sample(active_students, num_bookings)
        
        for j, student in enumerate(class_students):
            # Find a valid user package for this student
            # Note: Using basic validation since we know all seeded packages have valid payments
            student_packages = [up for up in user_packages if up.user_id == student.id and up.is_valid]
            if not student_packages:
                continue
            
            user_package = choice(student_packages)
            
            # Create booking
            booking_date = instance.start_datetime - timedelta(days=randint(0, 7))
            
            # Determine booking status
            if instance.status == ClassStatus.COMPLETED:
                # Historical bookings - mostly confirmed, some cancelled
                if random() < 0.05:  # 5% cancellation rate
                    status = BookingStatus.CANCELLED
                else:
                    status = BookingStatus.CONFIRMED
            else:
                # Future bookings - all confirmed
                status = BookingStatus.CONFIRMED
            
            booking = Booking(
                user_id=student.id,
                class_instance_id=instance.id,
                user_package_id=user_package.id,
                booking_date=booking_date,
                status=status,
                notes="הזמנה רגילה" if random() > 0.8 else None,
            )
            
            bookings.append(booking)
            session.add(booking)
        
        # Create waitlist entries for popular classes
        if num_bookings >= instance.template.capacity * 0.9:  # 90% full classes
            # 10-30% chance of waitlist entries
            if random() < 0.2:
                waitlist_size = randint(1, min(5, len(active_students) - num_bookings))
                remaining_students = [s for s in active_students if s not in class_students]
                
                if remaining_students:
                    waitlist_students = sample(remaining_students, min(waitlist_size, len(remaining_students)))
                    
                    for student in waitlist_students:
                        # Only add to waitlist if they have valid packages
                        student_packages = [up for up in user_packages if up.user_id == student.id and up.is_valid]
                        if student_packages:
                            user_package = choice(student_packages)
                            
                            waitlist_entry = WaitlistEntry(
                                user_id=student.id,
                                class_instance_id=instance.id,
                                user_package_id=user_package.id,
                                joined_date=instance.start_datetime - timedelta(days=randint(0, 5)),
                                position=len(waitlist_entries) + 1,
                            )
                            
                            waitlist_entries.append(waitlist_entry)
                            session.add(waitlist_entry)
        
        # Commit in batches
        if i % 100 == 99:
            await session.commit()
            print(f"התקדמות הזמנות: {i+1} מתוך {len(instances)} מופעים")
    
    await session.commit()
    
    print(f"נוצרו {len(bookings)} הזמנות ו-{len(waitlist_entries)} רשומות המתנה")
    return bookings, waitlist_entries


async def create_hebrew_social_features(session: AsyncSession, students: List[User]):
    """Create friendships and social connections."""
    print("יוצר קשרים חברתיים...")
    
    friendships = []
    
    # Create friendship network
    num_friendships = min(len(students) * 2, 500)  # Reasonable number
    
    for _ in range(num_friendships):
        user1, user2 = sample(students, 2)
        
        # Avoid duplicate friendships
        existing = any(
            (f.user_id == user1.id and f.friend_id == user2.id) or
            (f.user_id == user2.id and f.friend_id == user1.id)
            for f in friendships
        )
        
        if not existing:
            # Determine friendship status
            status_weights = {
                FriendshipStatus.ACCEPTED: 0.8,
                FriendshipStatus.PENDING: 0.15,
                FriendshipStatus.BLOCKED: 0.05
            }
            
            status = choice([s for s, w in status_weights.items() for _ in range(int(w * 100))])
            
            friendship = Friendship(
                user_id=user1.id,
                friend_id=user2.id,
                status=status,
                created_at=datetime.now(timezone.utc) - timedelta(days=randint(1, 180)),
            )
            
            friendships.append(friendship)
            session.add(friendship)
    
    await session.commit()
    print(f"נוצרו {len(friendships)} קשרי חברות")


async def create_hebrew_announcements(session: AsyncSession, admins: List[User]):
    """Create Hebrew announcements."""
    print("יוצר הודעות בעברית...")
    
    announcements = []
    
    for i, ann_data in enumerate(HEBREW_ANNOUNCEMENTS):
        # Vary the creation dates
        created_days_ago = randint(1, 45)
        created_at = datetime.now(timezone.utc) - timedelta(days=created_days_ago)
        
        # Determine expiry
        expires_at = created_at + timedelta(days=randint(7, 60))
        
        announcement = Announcement(
            title=ann_data["title"],
            message=ann_data["message"],
            type=ann_data["type"],
            target_roles=["student"] if i < 3 else ["student", "instructor", "admin"],
            expires_at=expires_at,
            created_by=choice(admins).id,
            is_active=expires_at > datetime.now(timezone.utc),
            is_dismissible=True,
            created_at=created_at,
        )
        
        announcements.append(announcement)
        session.add(announcement)
    
    # Add some instructor-only announcements
    instructor_announcements = [
        {
            "title": "הדרכות חדשות לצוות",
            "message": "ביום שני הקרוב תתקיים הדרכה על טכניקות חדשות בפילאטס. נושא החודש: שילוב תרגילי כדור.",
            "type": "info",
            "target_roles": ["instructor", "admin"]
        },
        {
            "title": "שכר מדריכים - עדכון",
            "message": "החל מהחודש הבא, תעריפי השכר עודכנו. פרטים במייל שנשלח אליכם בנפרד.",
            "type": "success",
            "target_roles": ["instructor"]
        }
    ]
    
    for ann_data in instructor_announcements:
        created_at = datetime.now(timezone.utc) - timedelta(days=randint(5, 20))
        expires_at = created_at + timedelta(days=30)
        
        announcement = Announcement(
            title=ann_data["title"],
            message=ann_data["message"],
            type=ann_data["type"],
            target_roles=ann_data["target_roles"],
            expires_at=expires_at,
            created_by=choice(admins).id,
            is_active=expires_at > datetime.now(timezone.utc),
            is_dismissible=True,
            created_at=created_at,
        )
        
        announcements.append(announcement)
        session.add(announcement)
    
    await session.commit()
    print(f"נוצרו {len(announcements)} הודעות")


async def seed_hebrew_heavy_database():
    """Main heavy Hebrew seeding function."""
    print("מתחיל זריעת מסד נתונים כבד בעברית...")
    print("=" * 60)
    print("זהו סקריפט מקיף שיוצר נתונים היסטוריים עד 2 חודשים אחורה")
    print("הסקריפט עלול לקחת מספר דקות - אנא התאזרו בסבלנות")
    print("=" * 60)

    start_time = datetime.now(timezone.utc)

    # Initialize database
    await init_db()

    async with AsyncSessionLocal() as session:
        # Create users
        print("\n📊 שלב 1: יצירת משתמשים")
        admins = await create_hebrew_admin_users(session)
        instructors = await create_hebrew_instructors(session, count=15)
        students = await create_hebrew_students(session, count=150)

        # Create packages
        print("\n📦 שלב 2: יצירת חבילות")
        packages = await create_hebrew_comprehensive_packages(session)

        # Create class templates
        print("\n🏃 שלב 3: יצירת תבניות שיעורים")
        templates = await create_hebrew_class_templates(session, instructors)

        # Create historical class instances (2 months back)
        print("\n📅 שלב 4: יצירת מופעי שיעורים היסטוריים")
        instances = await create_historical_class_instances(session, instructors, templates)

        # Create user packages with historical purchases
        print("\n💳 שלב 5: יצירת רכישות חבילות")
        user_packages = await create_hebrew_user_packages_bulk(session, students, packages, admins)

        # Create bookings and waitlists
        print("\n📝 שלב 6: יצירת הזמנות ורשימות המתנה")
        bookings, waitlist_entries = await create_hebrew_bookings_bulk(session, students, instances, user_packages)

        # Create social features
        print("\n👥 שלב 7: יצירת קשרים חברתיים")
        await create_hebrew_social_features(session, students)

        # Create Hebrew announcements
        print("\n📢 שלב 8: יצירת הודעות")
        await create_hebrew_announcements(session, admins)

    end_time = datetime.now(timezone.utc)
    duration = end_time - start_time
    
    print("\n" + "=" * 60)
    print("🎉 זריעת מסד הנתונים הושלמה בהצלחה!")
    print(f"⏱️  זמן ביצוע: {duration.total_seconds():.1f} שניות")
    print("=" * 60)
    
    print(f"""
📈 סיכום הנתונים שנוצרו:
   👥 משתמשים: {len(students) + len(instructors) + len(admins)} (מתוכם {len(students)} תלמידים)
   📦 חבילות: {len(packages)}
   🏃 תבניות שיעורים: {len(templates)}
   📅 מופעי שיעורים: {len(instances)} (כולל היסטוריה של 2 חודשים)
   💳 רכישות חבילות: {len(user_packages)}
   📝 הזמנות: {len(bookings)}
   ⏳ רשימות המתנה: {len(waitlist_entries)}
   📢 הודעות: 7
   
🔐 פרטי התחברות:
   🛡️  מנהל ראשי: admin@pilates.co.il / admin123
   🛡️  מנהל משנה: manager@pilates.co.il / manager123
   👨‍🏫 מדריכים: instructor1-15@pilates.co.il / instructor123
   👨‍🎓 תלמידים: student1-150@[עיר].co.il / student123

💡 טיפים לבדיקה:
   • בחרו עברית כשפה באפליקציה
   • בדקו תצוגת RTL (ימין לשמאל)
   • עיינו בנתונים ההיסטוריים מהחודשיים האחרונים
   • בדקו את מחזורי החיים של חבילות (קניה → שימוש → תפוגה)
   • בחנו את מערכת ההזמנות והמתנות
""")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(seed_hebrew_heavy_database())