"""enhance_package_approval_system_with_security_fixes

Revision ID: security_fix_001
Revises: 3d19930024a9
Create Date: 2024-08-23 00:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import String, Text, Boolean, Integer, DateTime
from sqlalchemy.sql import func

# revision identifiers
revision = 'security_fix_001'
down_revision = '3d19930024a9'
branch_labels = None
depends_on = None


def upgrade():
    """Add security enhancements to package approval system."""
    
    # Add new enum type for approval status (defensive creation)
    op.execute("""
        DO $$ BEGIN
            CREATE TYPE approvalstatus AS ENUM ('pending', 'in_review', 'approved', 'rejected', 'expired');
        EXCEPTION
            WHEN duplicate_object THEN null;
        END $$;
    """)
    
    # Add new columns to user_packages table for security and audit (with defensive checks)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_packages ADD COLUMN version INTEGER NOT NULL DEFAULT 1;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_packages ADD COLUMN approval_deadline TIMESTAMP WITH TIME ZONE;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_packages ADD COLUMN approval_status approvalstatus NOT NULL DEFAULT 'pending';
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_packages ADD COLUMN idempotency_key VARCHAR;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_packages ADD COLUMN last_approval_attempt_at TIMESTAMP WITH TIME ZONE;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_packages ADD COLUMN approval_attempt_count INTEGER NOT NULL DEFAULT 0;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    # Add unique constraint on idempotency_key (defensive)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE user_packages ADD CONSTRAINT uq_user_packages_idempotency_key UNIQUE (idempotency_key);
        EXCEPTION
            WHEN duplicate_table THEN null;
        END $$;
    """)
    
    # Update default payment_status to PENDING_APPROVAL for existing records
    op.execute("UPDATE user_packages SET payment_status = 'pending_approval' WHERE payment_status = 'approved' AND status = 'reserved'")
    
    # Add enhanced audit fields to payment_approvals table (with defensive checks)
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE payment_approvals ADD COLUMN package_version_at_approval INTEGER;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE payment_approvals ADD COLUMN failure_reason TEXT;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE payment_approvals ADD COLUMN ip_address VARCHAR(45);
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE payment_approvals ADD COLUMN user_agent TEXT;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE payment_approvals ADD COLUMN previous_status VARCHAR;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE payment_approvals ADD COLUMN approval_duration_seconds INTEGER;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE payment_approvals ADD COLUMN is_bulk_operation BOOLEAN NOT NULL DEFAULT FALSE;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    op.execute("""
        DO $$ BEGIN
            ALTER TABLE payment_approvals ADD COLUMN bulk_operation_id VARCHAR;
        EXCEPTION
            WHEN duplicate_column THEN null;
        END $$;
    """)
    
    # Create indexes for performance (defensive creation)
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_packages_approval_status 
        ON user_packages (approval_status)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_packages_payment_status_approval 
        ON user_packages (payment_status, approval_status)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_user_packages_approval_deadline 
        ON user_packages (approval_deadline)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_payment_approvals_ip_address 
        ON payment_approvals (ip_address)
    """)
    
    op.execute("""
        CREATE INDEX IF NOT EXISTS idx_payment_approvals_bulk_operation 
        ON payment_approvals (bulk_operation_id)
    """)


def downgrade():
    """Rollback security enhancements."""
    
    # Drop indexes
    op.drop_index('idx_payment_approvals_bulk_operation')
    op.drop_index('idx_payment_approvals_ip_address')
    op.drop_index('idx_user_packages_approval_deadline')
    op.drop_index('idx_user_packages_payment_status_approval')
    op.drop_index('idx_user_packages_approval_status')
    
    # Remove audit fields from payment_approvals
    op.drop_column('payment_approvals', 'bulk_operation_id')
    op.drop_column('payment_approvals', 'is_bulk_operation')
    op.drop_column('payment_approvals', 'approval_duration_seconds')
    op.drop_column('payment_approvals', 'previous_status')
    op.drop_column('payment_approvals', 'user_agent')
    op.drop_column('payment_approvals', 'ip_address')
    op.drop_column('payment_approvals', 'failure_reason')
    op.drop_column('payment_approvals', 'package_version_at_approval')
    
    # Drop unique constraint
    op.drop_constraint('uq_user_packages_idempotency_key', 'user_packages', type_='unique')
    
    # Remove new columns from user_packages
    op.drop_column('user_packages', 'approval_attempt_count')
    op.drop_column('user_packages', 'last_approval_attempt_at')
    op.drop_column('user_packages', 'idempotency_key')
    op.drop_column('user_packages', 'approval_status')
    op.drop_column('user_packages', 'approval_deadline')
    op.drop_column('user_packages', 'version')
    
    # Drop new enum type
    op.execute("DROP TYPE approvalstatus")