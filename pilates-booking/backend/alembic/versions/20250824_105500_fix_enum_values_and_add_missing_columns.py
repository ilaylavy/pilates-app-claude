"""Fix enum values and add missing columns for user packages

Revision ID: 20250824_105500
Revises: fdd1912253fa
Create Date: 2025-08-24 10:55:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250824_105500'
down_revision = '853ae1dbca46'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add missing enum values and columns for user packages."""
    
    # Step 1: Add missing enum values to userpackagepaymentstatus
    # Each enum addition must be in its own transaction
    connection = op.get_bind()
    
    # Add 'authorized' enum value
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("ALTER TYPE userpackagepaymentstatus ADD VALUE IF NOT EXISTS 'authorized'"))
    connection.execute(sa.text("COMMIT"))
    
    # Add 'payment_confirmed' enum value  
    connection.execute(sa.text("ALTER TYPE userpackagepaymentstatus ADD VALUE IF NOT EXISTS 'payment_confirmed'"))
    connection.execute(sa.text("COMMIT"))
    
    # Step 2: Create approvalstatus enum if it doesn't exist
    connection.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approvalstatus') THEN
                CREATE TYPE approvalstatus AS ENUM (
                    'pending',
                    'in_review', 
                    'authorized',
                    'payment_confirmed',
                    'rejected',
                    'expired'
                );
            END IF;
        END$$;
    """))
    connection.execute(sa.text("COMMIT"))
    
    # Add missing values to existing approvalstatus enum
    connection.execute(sa.text("ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'authorized'"))
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("ALTER TYPE approvalstatus ADD VALUE IF NOT EXISTS 'payment_confirmed'"))
    connection.execute(sa.text("COMMIT"))
    
    # Step 3: Add approval_status column if it doesn't exist
    op.execute("""
        DO $$
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_status') THEN
                ALTER TABLE user_packages ADD COLUMN approval_status approvalstatus DEFAULT 'pending' NOT NULL;
            END IF;
        END$$;
    """)
    
    # Step 4: Add other missing columns that the code expects
    op.execute("""
        DO $$
        BEGIN
            -- authorized_by column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'authorized_by') THEN
                ALTER TABLE user_packages ADD COLUMN authorized_by INTEGER REFERENCES users(id);
            END IF;
            
            -- authorized_at column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'authorized_at') THEN
                ALTER TABLE user_packages ADD COLUMN authorized_at TIMESTAMP WITH TIME ZONE;
            END IF;
            
            -- payment_confirmed_by column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmed_by') THEN
                ALTER TABLE user_packages ADD COLUMN payment_confirmed_by INTEGER REFERENCES users(id);
            END IF;
            
            -- payment_confirmed_at column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmed_at') THEN
                ALTER TABLE user_packages ADD COLUMN payment_confirmed_at TIMESTAMP WITH TIME ZONE;
            END IF;
            
            -- payment_confirmation_reference column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmation_reference') THEN
                ALTER TABLE user_packages ADD COLUMN payment_confirmation_reference VARCHAR;
            END IF;
            
            -- approval_deadline column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_deadline') THEN
                ALTER TABLE user_packages ADD COLUMN approval_deadline TIMESTAMP WITH TIME ZONE;
            END IF;
            
            -- idempotency_key column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'idempotency_key') THEN
                ALTER TABLE user_packages ADD COLUMN idempotency_key VARCHAR UNIQUE;
            END IF;
            
            -- last_approval_attempt_at column
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'last_approval_attempt_at') THEN
                ALTER TABLE user_packages ADD COLUMN last_approval_attempt_at TIMESTAMP WITH TIME ZONE;
            END IF;
            
            -- approval_attempt_count column  
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_attempt_count') THEN
                ALTER TABLE user_packages ADD COLUMN approval_attempt_count INTEGER DEFAULT 0 NOT NULL;
            END IF;
        END$$;
    """)
    
    # Step 5: Update existing data to use the new enum values
    # Now the enum values are committed and can be safely used
    op.execute("""
        UPDATE user_packages 
        SET payment_status = 'payment_confirmed'
        WHERE payment_status = 'approved';
    """)
    
    op.execute("""
        UPDATE user_packages 
        SET approval_status = (CASE 
            WHEN payment_status = 'pending_approval' THEN 'pending'
            WHEN payment_status = 'rejected' THEN 'rejected'
            WHEN payment_status = 'payment_confirmed' THEN 'payment_confirmed'
            WHEN payment_status = 'authorized' THEN 'authorized'
            ELSE 'pending'
        END)::approvalstatus;
    """)


def downgrade() -> None:
    """Reverse the enum and column changes."""
    
    # Remove added columns (in reverse order)
    columns_to_remove = [
        'approval_attempt_count',
        'last_approval_attempt_at', 
        'idempotency_key',
        'approval_deadline',
        'payment_confirmation_reference',
        'payment_confirmed_at',
        'payment_confirmed_by',
        'authorized_at',
        'authorized_by',
        'approval_status'
    ]
    
    for column in columns_to_remove:
        op.execute(f"""
            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = '{column}') THEN
                    ALTER TABLE user_packages DROP COLUMN {column};
                END IF;
            END$$;
        """)
    
    # Note: We can't easily remove enum values in PostgreSQL, so we leave them
    # This is generally acceptable as they don't cause harm
    
    # Revert data changes
    op.execute("""
        UPDATE user_packages 
        SET payment_status = 'approved'
        WHERE payment_status = 'payment_confirmed';
    """)