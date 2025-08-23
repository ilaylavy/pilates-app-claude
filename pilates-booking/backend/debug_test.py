#!/usr/bin/env python3
"""Debug the failing tests"""

from datetime import datetime, timezone, timedelta
from app.models.package import (
    UserPackage, Package, PaymentStatus, UserPackageStatus, 
    ApprovalStatus, PaymentMethod
)
from app.models.user import User, UserRole

def debug_double_approval():
    print("=== Debugging Double Approval Prevention ===")
    
    # Create test fixtures
    sample_user = User(
        id=1, email="test@example.com", first_name="Test", last_name="User",
        role=UserRole.STUDENT, is_active=True
    )
    
    sample_admin = User(
        id=2, email="admin@example.com", first_name="Admin", last_name="User", 
        role=UserRole.ADMIN, is_active=True
    )
    
    sample_package = Package(
        id=1, name="Basic Package", description="Test package",
        credits=10, price=100.0, validity_days=30, is_unlimited=False, is_active=True
    )
    
    expiry_date = datetime.now(timezone.utc) + timedelta(days=30)
    approval_deadline = datetime.now(timezone.utc) + timedelta(hours=72)
    
    pending_user_package = UserPackage(
        id=1, user_id=sample_user.id, package_id=sample_package.id,
        credits_remaining=10, expiry_date=expiry_date,
        status=UserPackageStatus.RESERVED,
        payment_status=PaymentStatus.PENDING_APPROVAL,
        payment_method=PaymentMethod.CASH,
        approval_status=ApprovalStatus.PENDING,
        approval_deadline=approval_deadline,
        version=1, approval_attempt_count=0, is_active=True
    )
    
    print(f"Initial state: payment_status={pending_user_package.payment_status}, approval_status={pending_user_package.approval_status}")
    
    # First approval should succeed
    success, message = pending_user_package.approve_payment(
        admin_id=sample_admin.id,
        expected_version=1
    )
    print(f"First approval: success={success}, message='{message}'")
    print(f"After first approval: payment_status={pending_user_package.payment_status}, approval_status={pending_user_package.approval_status}")
    
    if not success:
        print("PROBLEM: First approval failed!")
        return
    
    # Second approval should fail
    success, message = pending_user_package.approve_payment(
        admin_id=sample_admin.id,
        expected_version=pending_user_package.version
    )
    print(f"Second approval: success={success}, message='{message}'")
    
    if success:
        print("PROBLEM: Second approval succeeded when it should have failed!")
    else:
        print("SUCCESS: Second approval correctly failed")

def debug_approval_after_rejection():
    print("\n=== Debugging Approval After Rejection ===")
    
    # Create test fixtures
    sample_user = User(
        id=1, email="test@example.com", first_name="Test", last_name="User",
        role=UserRole.STUDENT, is_active=True
    )
    
    sample_admin = User(
        id=2, email="admin@example.com", first_name="Admin", last_name="User", 
        role=UserRole.ADMIN, is_active=True
    )
    
    expiry_date = datetime.now(timezone.utc) + timedelta(days=30)
    approval_deadline = datetime.now(timezone.utc) + timedelta(hours=72)
    
    pending_user_package = UserPackage(
        id=1, user_id=sample_user.id, package_id=1,
        credits_remaining=10, expiry_date=expiry_date,
        status=UserPackageStatus.RESERVED,
        payment_status=PaymentStatus.PENDING_APPROVAL,
        payment_method=PaymentMethod.CASH,
        approval_status=ApprovalStatus.PENDING,
        approval_deadline=approval_deadline,
        version=1, approval_attempt_count=0, is_active=True
    )
    
    print(f"Initial state: payment_status={pending_user_package.payment_status}, approval_status={pending_user_package.approval_status}")
    
    # First reject the package
    success, message = pending_user_package.reject_payment(
        admin_id=sample_admin.id,
        rejection_reason="Invalid payment",
        expected_version=1
    )
    print(f"Rejection: success={success}, message='{message}'")
    print(f"After rejection: payment_status={pending_user_package.payment_status}, approval_status={pending_user_package.approval_status}")
    
    if not success:
        print("PROBLEM: Rejection failed!")
        return
    
    # Try to approve - should fail
    success, message = pending_user_package.approve_payment(
        admin_id=sample_admin.id,
        expected_version=pending_user_package.version
    )
    print(f"Approval after rejection: success={success}, message='{message}'")
    
    if success:
        print("PROBLEM: Approval succeeded when it should have failed!")
    else:
        print("SUCCESS: Approval correctly failed")

if __name__ == "__main__":
    debug_double_approval()
    debug_approval_after_rejection()