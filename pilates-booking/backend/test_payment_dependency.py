#!/usr/bin/env python3
"""
Test script to verify UserPackage-Payment dependency implementation.
Run this after applying the migration to ensure constraints work properly.
"""

import asyncio
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import AsyncSessionLocal
from app.models.package import UserPackage, Package
from app.models.payment import Payment, PaymentStatus, PaymentMethod, PaymentType
from app.models.user import User
from app.services.package_service import PackageService


async def test_payment_dependency():
    """Test that UserPackages cannot be created without Payment records."""
    print("TESTING UserPackage-Payment dependency...")
    
    # Test 1: Try to create UserPackage without payment_id (should fail)
    print("\n1. Testing UserPackage creation without payment_id...")
    try:
        user_package = UserPackage(
            user_id=1,
            package_id=1,
            # payment_id is missing - should fail
            credits_remaining=10,
            expiry_date=None,
        )
        print("FAILED: UserPackage created without payment_id!")
        return False
    except (ValueError, Exception) as e:
        print(f"PASSED: UserPackage creation failed as expected: {str(e)[:100]}...")

    # Test 2: Try to create UserPackage with non-existent payment_id (should fail)
    print("\n2. Testing UserPackage creation with database constraints...")
    async with AsyncSessionLocal() as db:
        try:
            from datetime import datetime, timezone, timedelta
            user_package = UserPackage(
                user_id=1,
                package_id=1,
                payment_id=999999,  # Non-existent payment
                credits_remaining=10,
                expiry_date=datetime.now(timezone.utc) + timedelta(days=30),
            )
            db.add(user_package)
            await db.commit()
            print("FAILED: UserPackage created with invalid payment_id!")
            return False
        except Exception as e:
            print(f"PASSED: Database constraint prevented invalid UserPackage: {str(e)[:100]}...")
            await db.rollback()

    # Test 3: Use PackageService to create properly (should succeed)
    print("\n3. Testing PackageService.create_user_package...")
    async with AsyncSessionLocal() as db:
        try:
            # Find a user and package to use
            from sqlalchemy import select
            user_result = await db.execute(select(User).limit(1))
            user = user_result.scalar_one_or_none()
            
            package_result = await db.execute(select(Package).where(Package.is_active == True).limit(1))
            package = package_result.scalar_one_or_none()
            
            if not user or not package:
                print("SKIPPED: No users or packages found in database")
                return True
            
            user_package, payment = await PackageService.create_user_package(
                db=db,
                user_id=user.id,
                package_id=package.id,
                payment_method=PaymentMethod.CASH,
                payment_status=PaymentStatus.PENDING,
                payment_reference="TEST-PAYMENT-REF"
            )
            
            print(f"PASSED: UserPackage created successfully with payment_id={payment.id}")
            
            # Verify the relationship works
            if user_package.payment and user_package.payment.id == payment.id:
                print("PASSED: UserPackage-Payment relationship works correctly")
            else:
                print("FAILED: UserPackage-Payment relationship not working")
                return False
            
            # Clean up test data
            await db.delete(user_package)
            await db.delete(payment)
            await db.commit()
            
        except Exception as e:
            print(f"FAILED: PackageService failed: {str(e)}")
            return False

    print("\nAll tests passed! UserPackage-Payment dependency is working correctly.")
    return True


async def main():
    """Run all tests."""
    print("Starting UserPackage-Payment dependency tests...")
    
    success = await test_payment_dependency()
    
    if success:
        print("\nAll tests completed successfully!")
        sys.exit(0)
    else:
        print("\nSome tests failed!")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())