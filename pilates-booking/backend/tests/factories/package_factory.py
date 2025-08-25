"""
Package-related test factories.
"""

import factory
from datetime import datetime, timedelta
from decimal import Decimal
from faker import Faker

from app.models.package import Package, UserPackage, UserPackageStatus
from .base import BaseFactory
from .user_factory import UserFactory

fake = Faker()


class PackageFactory(BaseFactory):
    """Factory for creating packages."""
    
    class Meta:
        model = Package
        
    name = factory.Faker("word", ext_word_list=[
        "Single Class", "5-Class Package", "10-Class Package", 
        "20-Class Package", "Unlimited Monthly", "Unlimited Yearly"
    ])
    description = factory.Faker("text", max_nb_chars=200)
    credits = factory.LazyAttribute(lambda obj: {
        "Single Class": 1,
        "5-Class Package": 5,
        "10-Class Package": 10,
        "20-Class Package": 20,
        "Unlimited Monthly": 999,
        "Unlimited Yearly": 999
    }.get(obj.name, 10))
    
    price = factory.LazyAttribute(lambda obj: Decimal({
        "Single Class": "25.00",
        "5-Class Package": "115.00", 
        "10-Class Package": "220.00",
        "20-Class Package": "400.00",
        "Unlimited Monthly": "150.00",
        "Unlimited Yearly": "1500.00"
    }.get(obj.name, "100.00")))
    
    validity_days = factory.LazyAttribute(lambda obj: {
        "Single Class": 30,
        "5-Class Package": 60,
        "10-Class Package": 90,
        "20-Class Package": 120,
        "Unlimited Monthly": 30,
        "Unlimited Yearly": 365
    }.get(obj.name, 90))
    
    is_active = True
    is_unlimited = factory.LazyAttribute(lambda obj: "Unlimited" in obj.name)
    

class UserPackageFactory(BaseFactory):
    """Factory for creating user packages."""
    
    class Meta:
        model = UserPackage
        
    user = factory.SubFactory(UserFactory)
    package = factory.SubFactory(PackageFactory)
    status = UserPackageStatus.ACTIVE
    purchase_date = factory.LazyFunction(datetime.utcnow)
    expiry_date = factory.LazyAttribute(
        lambda obj: obj.purchase_date + timedelta(days=obj.package.validity_days)
    )
    credits_remaining = factory.LazyAttribute(lambda obj: obj.package.credits)
    is_active = True
    

class ExpiredUserPackageFactory(UserPackageFactory):
    """Factory for expired user packages."""
    
    status = UserPackageStatus.EXPIRED
    purchase_date = factory.LazyFunction(lambda: datetime.utcnow() - timedelta(days=120))
    expiry_date = factory.LazyFunction(lambda: datetime.utcnow() - timedelta(days=1))
    credits_remaining = 0
    is_active = False


class CancelledUserPackageFactory(UserPackageFactory):
    """Factory for cancelled user packages."""
    
    status = UserPackageStatus.CANCELLED
    credits_remaining = 0
    is_active = False


class PartiallyUsedUserPackageFactory(UserPackageFactory):
    """Factory for partially used packages."""
    
    credits_remaining = factory.LazyAttribute(
        lambda obj: max(0, obj.package.credits - fake.random_int(min=1, max=obj.package.credits))
    )