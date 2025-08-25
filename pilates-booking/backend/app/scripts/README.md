# Database Seeding Scripts

This directory contains comprehensive database seeding scripts for the Pilates booking system. The seeding system provides multiple scenarios for different testing and development needs.

## Quick Start

### Using the Seeding Manager (Recommended)

The seeding manager provides a centralized interface for all seeding operations:

```bash
# List available seeding options
python app/scripts/seed_manager.py list

# Check current database status  
python app/scripts/seed_manager.py status

# Clear database (with confirmation)
python app/scripts/seed_manager.py clear

# Run light seeding (clear first)
python app/scripts/seed_manager.py seed --type light --clear-first

# Run custom seeding with specific scenario
python app/scripts/seed_manager.py seed --type custom --scenario approval_testing
```

### Direct Script Execution

You can also run individual scripts directly:

```bash
# From backend directory
python app/scripts/seed_light.py
python app/scripts/seed_medium.py  
python app/scripts/seed_heavy.py
python app/scripts/seed_custom.py --scenario minimal
```

## Available Seeding Scripts

### 1. Light Seeding (`seed_light.py`)
**Purpose:** Minimal data for basic functionality testing
**Estimated Time:** < 30 seconds
**Data Created:**
- 3 users (1 admin, 1 instructor, 1 student)
- 2 basic packages (Single Class, 5-Class Pack)
- 1 class template (Morning Flow)
- 1 week of class instances

**Use Cases:**
- Unit testing
- Quick feature verification
- CI/CD pipeline testing
- Development environment setup

### 2. Medium Seeding (`seed_medium.py`)
**Purpose:** Comprehensive data for realistic testing scenarios
**Estimated Time:** 1-2 minutes
**Data Created:**
- 8 users (1 admin, 2 instructors, 5 students)
- 5 diverse packages with different features
- 6 class templates across the week
- 4 weeks of class instances (24 classes total)
- Multiple user packages with various approval states
- Sample bookings and cancellations
- Social connections (friendships)
- Payment history records

**Use Cases:**
- Feature development and testing
- Integration testing
- API endpoint testing
- UI development with realistic data

### 3. Heavy Seeding (`seed_heavy.py`)
**Purpose:** Large dataset for performance and stress testing
**Estimated Time:** 5-10 minutes
**Data Created:**
- 200+ users (2 admins, 12 instructors, 200 students)
- 13 comprehensive packages (including inactive ones)
- 20+ class templates with varied schedules
- 8 weeks of class instances (hundreds of classes)
- Complex user package relationships
- Thousands of bookings across all time periods
- Extensive social networks
- Comprehensive payment history

**Use Cases:**
- Performance testing
- Load testing
- Database optimization
- Scalability testing
- Production-like environment setup

### 4. Custom Seeding (`seed_custom.py`)
**Purpose:** Configurable scenarios for specific testing needs
**Estimated Time:** Variable
**Predefined Scenarios:**
- `balanced` - Default balanced dataset
- `approval_testing` - Focus on package approval workflows  
- `social_testing` - Emphasis on social features
- `booking_stress` - High booking load scenarios
- `payment_testing` - Focus on payment scenarios
- `minimal` - Minimal data for quick testing
- `performance` - Large dataset for performance testing

**Custom Parameters:**
- `--students N` - Number of students to create
- `--instructors N` - Number of instructors to create
- `--packages N` - Number of packages to create
- `--weeks N` - Number of weeks of classes
- `--approval-pending 0.3` - Percentage pending approval (0.0-1.0)
- `--booking-rate 0.8` - Average booking rate (0.0-1.0)
- `--no-social` - Disable social features
- `--no-payments` - Disable payment history

**Example Usage:**
```bash
# Approval testing scenario
python seed_custom.py --scenario approval_testing

# Custom configuration
python seed_custom.py --students 50 --instructors 3 --approval-pending 0.4

# Minimal social testing
python seed_custom.py --scenario social_testing --students 20 --no-payments
```

### 5. Original Seeding (`seed_data.py`)
**Purpose:** Original basic seeding script (maintained for compatibility)
**Estimated Time:** < 1 minute

## Seeding Manager Features

The seeding manager (`seed_manager.py`) provides centralized control over all seeding operations:

### Commands

#### List Available Scripts
```bash
python seed_manager.py list
```
Shows all available seeding scripts with descriptions and estimated times.

#### Check Database Status
```bash
python seed_manager.py status
```
Displays current record counts for all tables.

#### Clear Database
```bash
python seed_manager.py clear
python seed_manager.py clear --yes  # Skip confirmation
```
Safely clears all data from the database with foreign key handling.

#### Run Seeding
```bash
# Basic seeding
python seed_manager.py seed --type light
python seed_manager.py seed --type medium
python seed_manager.py seed --type heavy

# Clear database first
python seed_manager.py seed --type medium --clear-first

# Custom seeding with parameters
python seed_manager.py seed --type custom --scenario approval_testing
python seed_manager.py seed --type custom --students 100 --weeks 4
```

## Data Scenarios Explained

### Package Approval States

The seeding scripts create user packages in various approval states to test the two-step approval workflow:

1. **Pending Approval** (`PENDING_APPROVAL` + `PENDING`)
   - Package purchased but not yet reviewed by admin
   - User cannot use credits yet

2. **Authorized** (`AUTHORIZED` + `AUTHORIZED`) 
   - Admin has authorized credit usage
   - User can book classes but payment not confirmed

3. **Payment Confirmed** (`PAYMENT_CONFIRMED` + `PAYMENT_CONFIRMED`)
   - Full approval cycle completed
   - Package fully active and usable

4. **Rejected** (`REJECTED` + `REJECTED`)
   - Admin has rejected the package
   - Package moved to history

5. **Expired** (`EXPIRED` + various statuses)
   - Package validity period has passed
   - Cannot be used for new bookings

### Booking Patterns

The seeding scripts create realistic booking patterns:

- **Popular classes** (90% capacity) - Weekend morning classes, evening classes
- **Average classes** (60% capacity) - Weekday afternoon classes  
- **Less popular** (40% capacity) - Early morning, lunch break classes
- **Cancellations** (5-10% of bookings) - Realistic cancellation patterns
- **No-shows** (2-5% of past bookings) - Past classes with no-show status
- **Waitlist entries** - For fully booked popular classes

### Social Network Patterns

When social features are enabled, the scripts create:

- **Accepted friendships** (70% of friend requests)
- **Pending requests** (20% of friend requests)  
- **Blocked relationships** (10% of friend requests)
- **Friend clusters** - Groups of interconnected users
- **Class attendance together** - Friends booking the same classes

### Payment History

Payment records include:

- **Multiple payment methods** - Credit card, cash, bank transfer, PayPal
- **Various statuses** - Completed, pending, failed, refunded
- **External transaction IDs** - Realistic Stripe/PayPal identifiers
- **Refund scenarios** - Partial and full refunds with timestamps
- **Payment failure scenarios** - For testing error handling

## Development Workflow

### For New Features

1. Start with light seeding for basic functionality:
   ```bash
   python seed_manager.py seed --type light --clear-first
   ```

2. Test with medium seeding for integration:
   ```bash
   python seed_manager.py seed --type medium --clear-first
   ```

3. Performance test with heavy seeding:
   ```bash
   python seed_manager.py seed --type heavy --clear-first
   ```

### For Specific Testing

Use custom seeding for targeted testing:

```bash
# Testing approval workflows
python seed_manager.py seed --type custom --scenario approval_testing

# Testing social features  
python seed_manager.py seed --type custom --scenario social_testing

# Testing booking system under load
python seed_manager.py seed --type custom --scenario booking_stress
```

### For CI/CD Pipelines

Use light seeding with automated confirmation:

```bash
python seed_manager.py seed --type light --clear-first --yes
```

## Database Schema Coverage

The seeding scripts populate all major tables:

### Core Tables
- `users` - All user roles with realistic profiles
- `packages` - Diverse package offerings
- `user_packages` - Various approval and usage states
- `class_templates` - Weekly schedule templates
- `class_instances` - Actual scheduled classes

### Booking System
- `bookings` - Confirmed, cancelled, completed bookings
- `waitlist_entries` - Waitlist for popular classes
- `payments` - Payment history with various methods and statuses

### Social Features
- `friendships` - Friend relationships and requests
- `class_invitations` - Class invitations between friends

### Security & Audit
- `refresh_tokens` - JWT refresh tokens for auth testing
- `audit_logs` - Audit trail for security testing

## Performance Considerations

### Memory Usage
- Light seeding: ~10MB memory usage
- Medium seeding: ~50MB memory usage  
- Heavy seeding: ~200MB memory usage

### Database Size
- Light seeding: ~100 records total
- Medium seeding: ~500 records total
- Heavy seeding: ~5,000+ records total

### Execution Time
- Scripts use batch commits (50-100 records per commit)
- Foreign key relationships are handled properly
- Database constraints are respected

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   ```bash
   # Ensure Docker services are running
   make up
   
   # Check database connection
   docker-compose exec postgres psql -U pilates_user -d pilates_db
   ```

2. **Permission Errors**
   ```bash
   # Run with Python module flag
   python -m app.scripts.seed_manager list
   ```

3. **Foreign Key Constraint Errors**
   ```bash
   # Clear database first
   python seed_manager.py clear --yes
   ```

4. **Out of Memory Errors (Heavy Seeding)**
   ```bash
   # Use custom seeding with smaller parameters
   python seed_manager.py seed --type custom --students 50 --weeks 2
   ```

### Reset Database Completely

```bash
# Nuclear option - rebuild everything
make down
make reset-db
python seed_manager.py seed --type medium
```

## Integration with Testing

### Unit Tests

Use light seeding for unit test setup:

```python
# In test fixtures
import subprocess
subprocess.run(["python", "app/scripts/seed_light.py"])
```

### Integration Tests

Use medium seeding for comprehensive integration tests:

```bash
# Before integration test suite
python seed_manager.py seed --type medium --clear-first --yes
```

### Load Tests

Use heavy seeding for performance testing:

```bash
# Setup for load testing
python seed_manager.py seed --type heavy --clear-first --yes
```

## Extending the Seeding System

### Adding New Scenarios

1. Add scenario to `SeedingConfig.from_scenario()` in `seed_custom.py`
2. Configure parameters for the new scenario
3. Update documentation

### Adding New Data Types

1. Create new creation function (e.g., `create_memberships()`)
2. Add to seeding scripts where needed
3. Update seeding manager statistics display

### Custom Data Factories

For complex data patterns, consider using the existing factory pattern in `tests/factories/`:

```python
from tests.factories import UserFactory, PackageFactory

# Create users with specific patterns
users = UserFactory.create_batch(50, role=UserRole.STUDENT)
```

This seeding system provides comprehensive data scenarios for all aspects of the Pilates booking system, enabling effective development, testing, and performance validation.