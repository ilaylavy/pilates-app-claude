"""
User-related test factories.
"""

import factory
from faker import Faker

from app.core.security import get_password_hash
from app.models.user import User, UserRole
from .base import BaseFactory

fake = Faker()


class UserFactory(BaseFactory):
    """Factory for creating test users."""
    
    class Meta:
        model = User
        
    email = factory.Sequence(lambda n: f"user{n}@example.com")
    hashed_password = factory.LazyAttribute(lambda _: get_password_hash("TestPassword123!"))
    first_name = factory.Faker("first_name")
    last_name = factory.Faker("last_name")
    phone_number = factory.Faker("phone_number")
    role = UserRole.STUDENT
    is_active = True
    is_verified = True
    
    # Optional fields
    date_of_birth = factory.Faker("date_of_birth", minimum_age=18, maximum_age=80)
    emergency_contact_name = factory.Faker("name")
    emergency_contact_phone = factory.Faker("phone_number")
    health_conditions = factory.Faker("text", max_nb_chars=200)
    notes = factory.Faker("text", max_nb_chars=100)
    

class AdminFactory(UserFactory):
    """Factory for creating admin users."""
    
    email = factory.Sequence(lambda n: f"admin{n}@example.com")
    first_name = "Admin"
    role = UserRole.ADMIN


class InstructorFactory(UserFactory):
    """Factory for creating instructor users."""
    
    email = factory.Sequence(lambda n: f"instructor{n}@example.com")
    role = UserRole.INSTRUCTOR
    bio = factory.Faker("text", max_nb_chars=500)
    specialties = factory.LazyFunction(
        lambda: ", ".join(fake.random_elements(
            elements=["Pilates", "Yoga", "Barre", "Strength Training", "Flexibility"], 
            length=2, 
            unique=True
        ))
    )
    certifications = factory.LazyFunction(
        lambda: ", ".join(fake.random_elements(
            elements=["RYT-200", "PMA-CPT", "NASM-CPT", "ACE-CPT"], 
            length=2, 
            unique=True
        ))
    )
    

class InactiveUserFactory(UserFactory):
    """Factory for creating inactive users."""
    
    email = factory.Sequence(lambda n: f"inactive{n}@example.com")
    is_active = False


class UnverifiedUserFactory(UserFactory):
    """Factory for creating unverified users."""
    
    email = factory.Sequence(lambda n: f"unverified{n}@example.com")
    is_verified = False