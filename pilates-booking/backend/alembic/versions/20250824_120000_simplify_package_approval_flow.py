"""Simplify package approval flow - remove two-step approval

Revision ID: 20250824_120000
Revises: 20250824_105500
Create Date: 2025-08-24 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250824_120000'
down_revision = '20250824_105500'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Simplify package approval flow."""
    
    connection = op.get_bind()
    
    # Step 1: First, add temporary columns to store the new values
    op.add_column('user_packages', sa.Column('payment_status_temp', sa.String(50)))
    op.add_column('user_packages', sa.Column('status_temp', sa.String(50)))
    
    # Step 2: Update temporary columns with simplified values  
    op.execute("""
        UPDATE user_packages 
        SET payment_status_temp = (CASE 
            WHEN payment_status::text = 'pending_approval' THEN 'pending'
            WHEN payment_status::text = 'authorized' THEN 'pending'
            WHEN payment_status::text = 'payment_confirmed' THEN 'confirmed'
            WHEN payment_status::text = 'approved' THEN 'confirmed'
            WHEN payment_status::text = 'rejected' THEN 'rejected'
            ELSE 'confirmed'
        END);
    """)
    
    # Update user package status - remove RESERVED status
    op.execute("""
        UPDATE user_packages 
        SET status_temp = (CASE 
            WHEN status::text = 'reserved' THEN 'active'
            WHEN status::text = 'active' THEN 'active'
            WHEN status::text = 'expired' THEN 'expired'
            WHEN status::text = 'cancelled' THEN 'cancelled'
            ELSE 'active'
        END);
    """)
    
    # Step 2: Create new simplified enums
    
    # Create new payment status enum with simplified values
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("""
        CREATE TYPE userpackagepaymentstatus_new AS ENUM ('pending', 'confirmed', 'rejected');
    """))
    connection.execute(sa.text("COMMIT"))
    
    # Create new user package status enum without RESERVED
    connection.execute(sa.text("""
        CREATE TYPE userpackagestatus_new AS ENUM ('active', 'expired', 'cancelled');
    """))
    connection.execute(sa.text("COMMIT"))
    
    # Step 3: Drop old columns and rename temp columns
    op.drop_column('user_packages', 'payment_status')
    op.drop_column('user_packages', 'status')
    
    # Add new columns with new enum types
    op.add_column('user_packages', sa.Column('payment_status', sa.Enum('pending', 'confirmed', 'rejected', name='userpackagepaymentstatus_new'), nullable=False, server_default='confirmed'))
    op.add_column('user_packages', sa.Column('status', sa.Enum('active', 'expired', 'cancelled', name='userpackagestatus_new'), nullable=False, server_default='active'))
    
    # Step 4: Copy data from temp columns to new columns
    op.execute("""
        UPDATE user_packages 
        SET payment_status = payment_status_temp::userpackagepaymentstatus_new,
            status = status_temp::userpackagestatus_new;
    """)
    
    # Step 5: Drop temp columns
    op.drop_column('user_packages', 'payment_status_temp')
    op.drop_column('user_packages', 'status_temp')
    
    # Step 6: Drop old enums and rename new ones
    connection.execute(sa.text("DROP TYPE userpackagepaymentstatus CASCADE"))
    connection.execute(sa.text("ALTER TYPE userpackagepaymentstatus_new RENAME TO userpackagepaymentstatus"))
    connection.execute(sa.text("COMMIT"))
    
    connection.execute(sa.text("DROP TYPE userpackagestatus CASCADE"))
    connection.execute(sa.text("ALTER TYPE userpackagestatus_new RENAME TO userpackagestatus"))  
    connection.execute(sa.text("COMMIT"))
    
    # Step 5: Remove complex approval columns that are no longer needed
    columns_to_remove = [
        'authorized_by',
        'authorized_at', 
        'payment_confirmed_by',
        'payment_confirmed_at',
        'payment_confirmation_reference',
        'approval_status',
        'approval_deadline',
        'idempotency_key',
        'last_approval_attempt_at',
        'approval_attempt_count',
        'version',
        'reservation_expires_at'
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
    
    # Step 6: Drop the approvalstatus enum if it exists (no longer needed)
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("""
        DO $$
        BEGIN
            IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'approvalstatus') THEN
                DROP TYPE approvalstatus CASCADE;
            END IF;
        END$$;
    """))
    connection.execute(sa.text("COMMIT"))
    
    # Step 7: Update payment_status default to 'confirmed' (was 'pending_approval')
    op.execute("""
        ALTER TABLE user_packages 
        ALTER COLUMN payment_status SET DEFAULT 'confirmed';
    """)


def downgrade() -> None:
    """Reverse the simplification changes."""
    
    connection = op.get_bind()
    
    # Step 1: Recreate old complex enums
    connection.execute(sa.text("COMMIT"))
    connection.execute(sa.text("""
        CREATE TYPE userpackagepaymentstatus_old AS ENUM (
            'pending_approval', 'authorized', 'payment_confirmed', 'approved', 'rejected'
        );
    """))
    connection.execute(sa.text("COMMIT"))
    
    connection.execute(sa.text("""
        CREATE TYPE userpackagestatus_old AS ENUM ('active', 'reserved', 'expired', 'cancelled');
    """))
    connection.execute(sa.text("COMMIT"))
    
    connection.execute(sa.text("""
        CREATE TYPE approvalstatus AS ENUM (
            'pending', 'in_review', 'authorized', 'payment_confirmed', 'rejected', 'expired'
        );
    """))
    connection.execute(sa.text("COMMIT"))
    
    # Step 2: Update data back to old format
    op.execute("""
        UPDATE user_packages 
        SET payment_status = (CASE 
            WHEN payment_status = 'pending' THEN 'pending_approval'
            WHEN payment_status = 'confirmed' THEN 'payment_confirmed'
            WHEN payment_status = 'rejected' THEN 'rejected'
            ELSE 'pending_approval'
        END)::text;
    """)
    
    # Step 3: Update columns to use old enums
    op.execute("""
        ALTER TABLE user_packages 
        ALTER COLUMN payment_status TYPE userpackagepaymentstatus_old 
        USING payment_status::text::userpackagepaymentstatus_old;
    """)
    
    op.execute("""
        ALTER TABLE user_packages 
        ALTER COLUMN status TYPE userpackagestatus_old 
        USING status::text::userpackagestatus_old;
    """)
    
    # Step 4: Drop new enums and rename old ones back
    connection.execute(sa.text("DROP TYPE userpackagepaymentstatus CASCADE"))
    connection.execute(sa.text("ALTER TYPE userpackagepaymentstatus_old RENAME TO userpackagepaymentstatus"))
    connection.execute(sa.text("COMMIT"))
    
    connection.execute(sa.text("DROP TYPE userpackagestatus CASCADE"))  
    connection.execute(sa.text("ALTER TYPE userpackagestatus_old RENAME TO userpackagestatus"))
    connection.execute(sa.text("COMMIT"))
    
    # Step 5: Re-add the removed columns
    op.execute("""
        DO $$
        BEGIN
            -- Add back all the complex approval columns
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'authorized_by') THEN
                ALTER TABLE user_packages ADD COLUMN authorized_by INTEGER REFERENCES users(id);
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'authorized_at') THEN
                ALTER TABLE user_packages ADD COLUMN authorized_at TIMESTAMP WITH TIME ZONE;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmed_by') THEN
                ALTER TABLE user_packages ADD COLUMN payment_confirmed_by INTEGER REFERENCES users(id);
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmed_at') THEN
                ALTER TABLE user_packages ADD COLUMN payment_confirmed_at TIMESTAMP WITH TIME ZONE;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'payment_confirmation_reference') THEN
                ALTER TABLE user_packages ADD COLUMN payment_confirmation_reference VARCHAR;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_status') THEN
                ALTER TABLE user_packages ADD COLUMN approval_status approvalstatus DEFAULT 'pending' NOT NULL;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_deadline') THEN
                ALTER TABLE user_packages ADD COLUMN approval_deadline TIMESTAMP WITH TIME ZONE;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'idempotency_key') THEN
                ALTER TABLE user_packages ADD COLUMN idempotency_key VARCHAR UNIQUE;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'last_approval_attempt_at') THEN
                ALTER TABLE user_packages ADD COLUMN last_approval_attempt_at TIMESTAMP WITH TIME ZONE;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'approval_attempt_count') THEN
                ALTER TABLE user_packages ADD COLUMN approval_attempt_count INTEGER DEFAULT 0 NOT NULL;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'version') THEN
                ALTER TABLE user_packages ADD COLUMN version INTEGER DEFAULT 1 NOT NULL;
            END IF;
            
            IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_packages' AND column_name = 'reservation_expires_at') THEN
                ALTER TABLE user_packages ADD COLUMN reservation_expires_at TIMESTAMP WITH TIME ZONE;
            END IF;
        END$$;
    """)
    
    # Step 6: Reset payment_status default
    op.execute("""
        ALTER TABLE user_packages 
        ALTER COLUMN payment_status SET DEFAULT 'pending_approval';
    """)