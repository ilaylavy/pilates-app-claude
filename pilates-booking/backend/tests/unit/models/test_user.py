"""
Unit tests for User model.
Tests model validation, business logic, and relationships.
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User, UserRole
from app.core.security import verify_password, get_password_hash
from tests.factories import UserFactory, AdminFactory, InstructorFactory


class TestUserModel:
    """Test User model functionality."""

    @pytest.mark.unit
    async def test_create_user(self, db_session: AsyncSession):
        """Test creating a user with valid data."""
        user = UserFactory.build()
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        assert user.id is not None
        assert user.email is not None
        assert user.role == UserRole.STUDENT
        assert user.is_active is True
        assert user.is_verified is True

    @pytest.mark.unit
    async def test_user_password_hashing(self, db_session: AsyncSession):
        """Test that passwords are properly hashed."""
        password = "TestPassword123!"
        hashed = get_password_hash(password)
        
        user = UserFactory.build(hashed_password=hashed)
        db_session.add(user)
        await db_session.commit()
        
        # Password should be hashed, not stored in plain text
        assert user.hashed_password != password
        assert verify_password(password, user.hashed_password)

    @pytest.mark.unit
    async def test_user_full_name_property(self, db_session: AsyncSession):
        """Test the full_name property."""
        user = UserFactory.build(first_name="John", last_name="Doe")
        assert user.full_name == "John Doe"

    @pytest.mark.unit
    async def test_user_roles(self, db_session: AsyncSession):
        """Test different user roles."""
        student = UserFactory.build(role=UserRole.STUDENT)
        instructor = InstructorFactory.build()
        admin = AdminFactory.build()
        
        assert student.role == UserRole.STUDENT
        assert instructor.role == UserRole.INSTRUCTOR
        assert admin.role == UserRole.ADMIN
        
        assert not student.is_admin
        assert not instructor.is_admin
        assert admin.is_admin

    @pytest.mark.unit
    async def test_user_is_admin_property(self, db_session: AsyncSession):
        """Test the is_admin property."""
        student = UserFactory.build(role=UserRole.STUDENT)
        instructor = InstructorFactory.build()
        admin = AdminFactory.build()
        
        assert not student.is_admin
        assert not instructor.is_admin
        assert admin.is_admin

    @pytest.mark.unit
    async def test_user_is_instructor_property(self, db_session: AsyncSession):
        """Test the is_instructor property."""
        student = UserFactory.build(role=UserRole.STUDENT)
        instructor = InstructorFactory.build()
        admin = AdminFactory.build()
        
        assert not student.is_instructor
        assert instructor.is_instructor
        assert not admin.is_instructor

    @pytest.mark.unit 
    async def test_user_email_validation(self, db_session: AsyncSession):
        """Test email validation."""
        # Valid email should work
        user = UserFactory.build(email="test@example.com")
        db_session.add(user)
        await db_session.commit()
        assert user.email == "test@example.com"

    @pytest.mark.unit
    async def test_user_age_calculation(self, db_session: AsyncSession):
        """Test age calculation from date of birth."""
        # Set birth date to 30 years ago
        birth_date = datetime.now().date() - timedelta(days=30*365)
        user = UserFactory.build(date_of_birth=birth_date)
        
        age = user.age
        assert age >= 29 and age <= 31  # Account for leap years

    @pytest.mark.unit
    async def test_user_age_none_when_no_birth_date(self, db_session: AsyncSession):
        """Test age returns None when no birth date is set."""
        user = UserFactory.build(date_of_birth=None)
        assert user.age is None

    @pytest.mark.unit
    async def test_user_string_representation(self, db_session: AsyncSession):
        """Test the __str__ method."""
        user = UserFactory.build(
            first_name="John",
            last_name="Doe",
            email="john@example.com"
        )
        
        assert str(user) == "John Doe (john@example.com)"

    @pytest.mark.unit
    async def test_user_can_book_classes(self, db_session: AsyncSession):
        """Test that active, verified users can book classes."""
        active_user = UserFactory.build(is_active=True, is_verified=True)
        inactive_user = UserFactory.build(is_active=False, is_verified=True)
        unverified_user = UserFactory.build(is_active=True, is_verified=False)
        
        assert active_user.can_book_classes
        assert not inactive_user.can_book_classes
        assert not unverified_user.can_book_classes

    @pytest.mark.unit
    async def test_instructor_fields(self, db_session: AsyncSession):
        """Test instructor-specific fields."""
        instructor = InstructorFactory.build(
            bio="Experienced instructor",
            specialties="Pilates, Yoga",
            certifications="RYT-200, PMA-CPT"
        )
        
        assert instructor.bio == "Experienced instructor"
        assert instructor.specialties == "Pilates, Yoga"
        assert instructor.certifications == "RYT-200, PMA-CPT"
        assert instructor.is_instructor

    @pytest.mark.unit
    async def test_user_created_and_updated_timestamps(self, db_session: AsyncSession):
        """Test that created_at and updated_at are set properly."""
        user = UserFactory.build()
        db_session.add(user)
        await db_session.commit()
        await db_session.refresh(user)
        
        assert user.created_at is not None
        assert user.updated_at is not None
        assert user.created_at <= user.updated_at

    @pytest.mark.unit
    async def test_user_phone_number_formatting(self, db_session: AsyncSession):
        """Test phone number storage and formatting."""
        user = UserFactory.build(phone_number="+1234567890")
        assert user.phone_number == "+1234567890"

    @pytest.mark.unit
    async def test_user_emergency_contact_fields(self, db_session: AsyncSession):
        """Test emergency contact fields."""
        user = UserFactory.build(
            emergency_contact_name="Jane Doe",
            emergency_contact_phone="+1987654321"
        )
        
        assert user.emergency_contact_name == "Jane Doe"
        assert user.emergency_contact_phone == "+1987654321"

    @pytest.mark.unit
    async def test_user_health_conditions_and_notes(self, db_session: AsyncSession):
        """Test health conditions and notes fields."""
        user = UserFactory.build(
            health_conditions="Lower back issues",
            notes="Prefers morning classes"
        )
        
        assert user.health_conditions == "Lower back issues"
        assert user.notes == "Prefers morning classes"