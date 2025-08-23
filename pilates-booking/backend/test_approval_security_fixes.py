#!/usr/bin/env python3
"""
Test script for package approval security fixes
Tests the critical vulnerabilities and business logic fixes
"""
import asyncio
import pytest
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from unittest.mock import Mock

# Import our models and services
from app.models.package import (
    UserPackage, Package, PaymentStatus, UserPackageStatus, 
    ApprovalStatus, PaymentMethod, PaymentApproval, PaymentApprovalAction
)
from app.models.user import User, UserRole
from app.core.database import Base


class TestPackageApprovalSecurityFixes:
    """Test suite for package approval security vulnerabilities and fixes."""
    
    @pytest.fixture
    async def db_session(self):
        """Create test database session."""
        # Use in-memory SQLite for testing
        engine = create_async_engine("sqlite+aiosqlite:///:memory:")
        
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        
        AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
        session = AsyncSessionLocal()
        yield session
        await session.close()
        await engine.dispose()

    @pytest.fixture
    def sample_user(self):
        """Create sample user."""
        return User(
            id=1,
            email="test@example.com",
            first_name="Test",
            last_name="User",
            role=UserRole.STUDENT,
            is_active=True
        )

    @pytest.fixture
    def sample_admin(self):
        """Create sample admin user."""
        return User(
            id=2,
            email="admin@example.com", 
            first_name="Admin",
            last_name="User",
            role=UserRole.ADMIN,
            is_active=True
        )

    @pytest.fixture
    def sample_package(self):
        """Create sample package."""
        return Package(
            id=1,
            name="Basic Package",
            description="Test package",
            credits=10,
            price=100.0,
            validity_days=30,
            is_unlimited=False,
            is_active=True
        )

    @pytest.fixture
    def pending_user_package(self, sample_user, sample_package):
        """Create a pending approval user package."""
        expiry_date = datetime.now(timezone.utc) + timedelta(days=30)
        approval_deadline = datetime.now(timezone.utc) + timedelta(hours=72)
        
        return UserPackage(
            id=1,
            user_id=sample_user.id,
            package_id=sample_package.id,
            credits_remaining=10,
            expiry_date=expiry_date,
            status=UserPackageStatus.RESERVED,
            payment_status=PaymentStatus.PENDING_APPROVAL,
            payment_method=PaymentMethod.CASH,
            approval_status=ApprovalStatus.PENDING,
            approval_deadline=approval_deadline,
            version=1,
            approval_attempt_count=0,
            is_active=True
        )

    async def test_optimistic_locking_prevents_race_conditions(self, pending_user_package, sample_admin):
        """Test that optimistic locking prevents race conditions during approval."""
        
        # Simulate first admin starting approval process
        current_version = pending_user_package.version
        
        # Simulate concurrent modification (version increment)
        pending_user_package.version += 1
        
        # Try to approve with old version - should fail
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=current_version
        )
        
        assert not success
        assert "Expected version" in message
        assert pending_user_package.payment_status == PaymentStatus.PENDING_APPROVAL

    def test_prevent_double_approval(self, pending_user_package, sample_admin):
        """Test that packages cannot be approved twice."""
        
        # First approval should succeed
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=1
        )
        assert success
        assert pending_user_package.approval_status == ApprovalStatus.APPROVED
        
        # Second approval should fail
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=pending_user_package.version
        )
        assert not success
        assert ("already approved" in message.lower() or "not pending approval" in message.lower())

    def test_prevent_approval_after_rejection(self, pending_user_package, sample_admin):
        """Test that rejected packages cannot be approved."""
        
        # First reject the package
        success, message = pending_user_package.reject_payment(
            admin_id=sample_admin.id,
            rejection_reason="Invalid payment",
            expected_version=1
        )
        assert success
        assert pending_user_package.approval_status == ApprovalStatus.REJECTED
        
        # Try to approve - should fail
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=pending_user_package.version
        )
        assert not success
        assert ("already rejected" in message.lower() or "not pending approval" in message.lower())

    async def test_approval_deadline_enforcement(self, pending_user_package, sample_admin):
        """Test that expired approval deadlines are enforced."""
        
        # Set deadline to past
        pending_user_package.approval_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        
        # Try to approve - should fail
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=1
        )
        assert not success
        assert "deadline has passed" in message
        assert pending_user_package.approval_status == ApprovalStatus.EXPIRED

    async def test_reservation_expiry_check(self, pending_user_package, sample_admin):
        """Test that expired reservations cannot be approved."""
        
        # Set reservation expiry to past
        pending_user_package.reservation_expires_at = datetime.now(timezone.utc) - timedelta(hours=1)
        
        # Try to approve - should fail
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=1
        )
        assert not success
        assert "expired and cannot be approved" in message

    async def test_rejection_requires_reason(self, pending_user_package, sample_admin):
        """Test that rejection requires a reason."""
        
        # Try to reject without reason - should fail
        success, message = pending_user_package.reject_payment(
            admin_id=sample_admin.id,
            rejection_reason="",
            expected_version=1
        )
        assert not success
        assert "required" in message
        
        # Try with whitespace only - should fail
        success, message = pending_user_package.reject_payment(
            admin_id=sample_admin.id,
            rejection_reason="   ",
            expected_version=1
        )
        assert not success
        assert "required" in message

    async def test_payment_status_validation(self, pending_user_package, sample_admin):
        """Test that only pending payments can be processed."""
        
        # Change status to approved
        pending_user_package.payment_status = PaymentStatus.APPROVED
        
        # Try to approve again - should fail
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=1
        )
        assert not success
        assert "not pending approval" in message

    async def test_can_be_approved_property(self, pending_user_package):
        """Test the can_be_approved property works correctly."""
        
        # Should be approvable initially
        assert pending_user_package.can_be_approved
        
        # Should not be approvable after deadline
        pending_user_package.approval_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        assert not pending_user_package.can_be_approved
        
        # Reset deadline
        pending_user_package.approval_deadline = datetime.now(timezone.utc) + timedelta(hours=72)
        assert pending_user_package.can_be_approved
        
        # Should not be approvable if already approved
        pending_user_package.approval_status = ApprovalStatus.APPROVED
        assert not pending_user_package.can_be_approved

    async def test_audit_record_creation(self, pending_user_package, sample_admin):
        """Test that comprehensive audit records are created."""
        
        # Create approval audit record
        audit_record = PaymentApproval.create_approval_record(
            user_package=pending_user_package,
            admin_id=sample_admin.id,
            action=PaymentApprovalAction.APPROVED,
            notes="Test approval",
            ip_address="127.0.0.1",
            user_agent="Test Browser",
            approval_duration_seconds=30
        )
        
        assert audit_record.user_package_id == pending_user_package.id
        assert audit_record.admin_id == sample_admin.id
        assert audit_record.action == PaymentApprovalAction.APPROVED
        assert audit_record.notes == "Test approval"
        assert audit_record.ip_address == "127.0.0.1"
        assert audit_record.user_agent == "Test Browser"
        assert audit_record.approval_duration_seconds == 30
        assert audit_record.package_version_at_approval == pending_user_package.version

    async def test_idempotency_key_generation(self, pending_user_package):
        """Test that idempotency keys are generated correctly."""
        
        key = pending_user_package.generate_idempotency_key()
        
        assert key.startswith("pkg_1_")
        assert len(key) == 14  # pkg_1_ (6) + 8 hex chars
        assert pending_user_package.idempotency_key == key

    async def test_version_increments_on_operations(self, pending_user_package, sample_admin):
        """Test that version increments on state changes."""
        
        initial_version = pending_user_package.version
        
        # Approval should increment version
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=initial_version
        )
        assert success
        assert pending_user_package.version == initial_version + 1
        
        # Reset for rejection test
        pending_user_package.payment_status = PaymentStatus.PENDING_APPROVAL
        pending_user_package.approval_status = ApprovalStatus.PENDING
        current_version = pending_user_package.version
        
        # Rejection should increment version
        success, message = pending_user_package.reject_payment(
            admin_id=sample_admin.id,
            rejection_reason="Test rejection",
            expected_version=current_version
        )
        assert success
        assert pending_user_package.version == current_version + 1

    async def test_approval_timeout_calculation(self, pending_user_package):
        """Test approval timeout calculation."""
        
        # Set deadline to 5 hours from now
        pending_user_package.approval_deadline = datetime.now(timezone.utc) + timedelta(hours=5)
        timeout = pending_user_package.approval_timeout_hours
        assert timeout == 5
        
        # Set deadline to past
        pending_user_package.approval_deadline = datetime.now(timezone.utc) - timedelta(hours=1)
        timeout = pending_user_package.approval_timeout_hours
        assert timeout == 0
        
        # No deadline set
        pending_user_package.approval_deadline = None
        timeout = pending_user_package.approval_timeout_hours
        assert timeout == -1

    async def test_activation_requires_approved_payment(self, pending_user_package):
        """Test that reservation activation requires approved payment."""
        
        # Try to activate without approved payment - should fail
        success, message = pending_user_package.activate_from_reservation()
        assert not success
        assert "Payment must be approved first" in message
        
        # Approve payment first
        pending_user_package.payment_status = PaymentStatus.APPROVED
        
        # Now activation should succeed
        success, message = pending_user_package.activate_from_reservation()
        assert success
        assert pending_user_package.status == UserPackageStatus.ACTIVE

    async def test_is_valid_includes_approval_status(self, pending_user_package, sample_package):
        """Test that is_valid property includes approval status check."""
        
        # Mock the package relationship
        pending_user_package.package = sample_package
        
        # Should not be valid if not approved
        assert not pending_user_package.is_valid
        
        # Set all required conditions
        pending_user_package.status = UserPackageStatus.ACTIVE
        pending_user_package.payment_status = PaymentStatus.APPROVED
        pending_user_package.approval_status = ApprovalStatus.APPROVED
        
        # Now should be valid
        assert pending_user_package.is_valid

    def test_approval_attempt_tracking(self, pending_user_package, sample_admin):
        """Test that approval attempts are tracked."""
        
        initial_count = pending_user_package.approval_attempt_count
        
        # Successful approval should increment counter
        success, message = pending_user_package.approve_payment(
            admin_id=sample_admin.id,
            expected_version=1
        )
        assert success
        assert pending_user_package.approval_attempt_count == initial_count + 1
        assert pending_user_package.last_approval_attempt_at is not None


async def run_all_tests():
    """Run all security fix tests."""
    print("Running Package Approval Security Tests...")
    
    test_class = TestPackageApprovalSecurityFixes()
    
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
    
    def create_pending_package():
        expiry_date = datetime.now(timezone.utc) + timedelta(days=30)
        approval_deadline = datetime.now(timezone.utc) + timedelta(hours=72)
        
        return UserPackage(
            id=1, user_id=sample_user.id, package_id=sample_package.id,
            credits_remaining=10, expiry_date=expiry_date,
            status=UserPackageStatus.RESERVED,
            payment_status=PaymentStatus.PENDING_APPROVAL,
            payment_method=PaymentMethod.CASH,
            approval_status=ApprovalStatus.PENDING,
            approval_deadline=approval_deadline,
            version=1, approval_attempt_count=0, is_active=True
        )
    
    tests_passed = 0
    tests_failed = 0
    
    test_methods = [
        ("Optimistic Locking", test_class.test_optimistic_locking_prevents_race_conditions),
        ("Double Approval Prevention", test_class.test_prevent_double_approval),
        ("Approval After Rejection", test_class.test_prevent_approval_after_rejection),
        ("Deadline Enforcement", test_class.test_approval_deadline_enforcement),
        ("Reservation Expiry Check", test_class.test_reservation_expiry_check),
        ("Rejection Reason Validation", test_class.test_rejection_requires_reason),
        ("Payment Status Validation", test_class.test_payment_status_validation),
        ("Can Be Approved Logic", test_class.test_can_be_approved_property),
        ("Audit Record Creation", test_class.test_audit_record_creation),
        ("Idempotency Key Generation", test_class.test_idempotency_key_generation),
        ("Version Increment Tracking", test_class.test_version_increments_on_operations),
        ("Timeout Calculation", test_class.test_approval_timeout_calculation),
        ("Activation Payment Check", test_class.test_activation_requires_approved_payment),
        ("Validity Status Check", test_class.test_is_valid_includes_approval_status),
        ("Attempt Tracking", test_class.test_approval_attempt_tracking),
    ]
    
    for test_name, test_method in test_methods:
        try:
            # Handle different argument patterns
            if test_name in ["Can Be Approved Logic", "Idempotency Key Generation", "Timeout Calculation", "Activation Payment Check"]:
                result = test_method(create_pending_package())
            elif test_name == "Validity Status Check":
                result = test_method(create_pending_package(), sample_package)
            elif test_name in ["Audit Record Creation"]:
                result = test_method(create_pending_package(), sample_admin)
            else:
                result = test_method(create_pending_package(), sample_admin)
            
            # If the result is awaitable, await it
            if hasattr(result, '__await__'):
                await result
                
            print(f"[PASS] {test_name}: PASSED")
            tests_passed += 1
        except Exception as e:
            print(f"[FAIL] {test_name}: FAILED - {str(e)}")
            tests_failed += 1
    
    print(f"\nTest Results: {tests_passed} passed, {tests_failed} failed")
    
    if tests_failed == 0:
        print("All security fixes are working correctly!")
        return True
    else:
        print("Some tests failed. Please review the implementation.")
        return False


if __name__ == "__main__":
    asyncio.run(run_all_tests())