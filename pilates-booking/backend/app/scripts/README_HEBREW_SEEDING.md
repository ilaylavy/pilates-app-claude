# Hebrew Database Seeding

This project includes two Hebrew seeding scripts for testing the internationalization (i18n) implementation:

1. **`seed_data_hebrew.py`** - Light Hebrew seeding (basic content)
2. **`seed_data_hebrew_heavy.py`** - Comprehensive Hebrew seeding with 2 months of historical data

## What it creates:

### Users (משתמשים)
- **Admin**: דני כהן (`admin@pilates.co.il`)
- **Instructors**: מיה לוי (`maya@pilates.co.il`), טל ברק (`tal@pilates.co.il`)
- **Students**: נועה שמש, עמית ארז, שירה מור, יוני דוד, רחל אברהם

### Packages (חבילות)
1. **שיעור יחיד** - Single class for beginners (₪80)
2. **חבילת 5 שיעורים** - 5-class package (₪340)
3. **חבילת 10 שיעורים** - 10-class package (₪600)
4. **מנוי חודשי ללא הגבלה** - Monthly unlimited (₪450)
5. **חבילת סטודנטים** - Student discount package (₪480)
6. **מנוי שנתי VIP** - Annual VIP membership (₪4800)

### Class Templates (תבניות שיעורים)
- **פילאטס בוקר** - Morning Pilates (Sunday 8:00)
- **יסודות למתחילים** - Beginner Basics (Monday 17:30)
- **פילאטס כוח** - Power Pilates (Tuesday 19:00)
- **הפסקת צהריים פעילה** - Active Lunch Break (Wednesday 12:30)
- **פילאטס ערב** - Evening Pilates (Thursday 18:00)
- **חלל ליבה** - Core Focus (Thursday 19:30)
- **סוף שבוע אקטיבי** - Active Weekend (Friday 9:30)
- **פילאטס משקם** - Rehabilitation Pilates (Friday 11:00)
- **אימון סוף שבוע** - Weekend Workout (Saturday 10:00)
- **יוגה-פילאטס** - Yoga-Pilates Fusion (Saturday 11:30)

### Announcements (הודעות)
- Welcome message in Hebrew
- New class announcements
- Special offers and promotions
- Schedule changes
- Instructor notifications

## Heavy Hebrew Seeding Features:

The `hebrew-heavy` script creates a comprehensive dataset:

- **150 students** with Hebrew names and Israeli contact details
- **15 instructors** with varied Hebrew profiles  
- **14 comprehensive packages** including special offers
- **2 months of historical data** - classes, bookings, payments going back 60 days
- **Realistic booking patterns** - varied attendance, cancellations, waitlists
- **Complete payment history** - confirmed, pending, and rejected payments
- **Social features** - friendships, connections between users
- **Hebrew announcements** - realistic studio communications
- **Cultural authenticity** - Israeli phone numbers, email domains, pricing in ₪

## Usage:

### Using the Makefile (Recommended):
```bash
# Light Hebrew seeding (quick test)
make seed-hebrew

# Heavy Hebrew seeding with historical data (recommended)  
make seed-hebrew-heavy

# Reset entire database with light Hebrew content
make reset-db-hebrew

# Reset entire database with comprehensive Hebrew data
make reset-db-hebrew-heavy

# List all available seeding options
make seed-list
```

### Using the seed manager directly:
```bash
# Light Hebrew seeding
docker-compose exec backend python -m app.scripts.seed_manager seed --type hebrew --clear-first --yes

# Heavy Hebrew seeding (comprehensive)
docker-compose exec backend python -m app.scripts.seed_manager seed --type hebrew-heavy --clear-first --yes

# List all available scripts
docker-compose exec backend python -m app.scripts.seed_manager list

# Check database status
docker-compose exec backend python -m app.scripts.seed_manager status
```

### Running the scripts directly:
```bash
# Light Hebrew seeding
docker-compose exec backend python app/scripts/seed_data_hebrew.py

# Heavy Hebrew seeding
docker-compose exec backend python app/scripts/seed_data_hebrew_heavy.py
```

## Login Credentials:

### Admin:
- Email: `admin@pilates.co.il`
- Password: `admin123`

### Instructors:
- Email: `maya@pilates.co.il` / Password: `instructor123`
- Email: `tal@pilates.co.il` / Password: `instructor123`

### Students:
- Email: `noa@example.co.il` / Password: `student123`
- Plus 4 additional students with similar patterns

## Testing i18n Features:

1. **Hebrew Content**: All names, descriptions, and announcements are in Hebrew
2. **RTL Layout**: Test RTL layouts with Hebrew text
3. **Date/Time Formatting**: Hebrew locale formatting
4. **Currency**: Israeli Shekel (₪) formatting
5. **Pluralization**: Hebrew pluralization rules testing

## Notes:

- Israeli phone numbers format (`+972-50-xxx-xxxx`)
- Israeli email domains (`.co.il`)
- Hebrew cultural context in descriptions
- Realistic Hebrew names and surnames
- Class times suitable for Israeli schedule (Sunday-Saturday week)
- Prices in Israeli Shekels (₪)

This seeding script is perfect for:
- Testing Hebrew language support
- Validating RTL layouts
- Verifying i18n implementation
- Demo purposes with Hebrew content
- Cultural localization testing