"""
Class-related test factories.
"""

import factory
from datetime import datetime, timedelta
from faker import Faker

from app.models.class_schedule import ClassTemplate, ClassInstance, ClassLevel, WeekDay, ClassStatus
from .base import BaseFactory
from .user_factory import InstructorFactory

fake = Faker()


class ClassTemplateFactory(BaseFactory):
    """Factory for creating class templates."""
    
    class Meta:
        model = ClassTemplate
        
    name = factory.Faker("word", ext_word_list=[
        "Pilates Fundamentals", "Advanced Pilates", "Beginner Yoga", 
        "Hot Yoga", "Barre Fusion", "Strength & Conditioning",
        "Flexibility & Mobility", "Core Power", "Meditation & Mindfulness"
    ])
    description = factory.Faker("text", max_nb_chars=300)
    duration_minutes = factory.Faker("random_element", elements=[45, 60, 75, 90])
    capacity = factory.Faker("random_int", min=8, max=20)
    level = factory.Faker("random_element", elements=list(ClassLevel))
    day_of_week = factory.Faker("random_element", elements=list(WeekDay))
    start_time = factory.Faker("time_object")
    is_active = True


class ClassInstanceFactory(BaseFactory):
    """Factory for creating class instances."""
    
    class Meta:
        model = ClassInstance
        
    template = factory.SubFactory(ClassTemplateFactory)
    instructor = factory.SubFactory(InstructorFactory)
    
    # Schedule for next week by default
    start_datetime = factory.LazyFunction(
        lambda: datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + 
        timedelta(days=fake.random_int(min=1, max=14))
    )
    end_datetime = factory.LazyAttribute(
        lambda obj: obj.start_datetime + timedelta(minutes=obj.template.duration_minutes)
    )
    
    status = ClassStatus.SCHEDULED
    notes = factory.Faker("text", max_nb_chars=200)
    
    
class CancelledClassInstanceFactory(ClassInstanceFactory):
    """Factory for cancelled class instances."""
    
    status = ClassStatus.CANCELLED
    notes = factory.Faker("sentence", nb_words=6)


class PastClassInstanceFactory(ClassInstanceFactory):
    """Factory for past class instances."""
    
    start_datetime = factory.LazyFunction(
        lambda: datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) - 
        timedelta(days=fake.random_int(min=1, max=30))
    )
    end_datetime = factory.LazyAttribute(
        lambda obj: obj.start_datetime + timedelta(minutes=obj.template.duration_minutes)
    )


class FutureClassInstanceFactory(ClassInstanceFactory):
    """Factory for future class instances."""
    
    start_datetime = factory.LazyFunction(
        lambda: datetime.utcnow().replace(hour=10, minute=0, second=0, microsecond=0) + 
        timedelta(days=fake.random_int(min=1, max=30))
    )
    end_datetime = factory.LazyAttribute(
        lambda obj: obj.start_datetime + timedelta(minutes=obj.template.duration_minutes)
    )