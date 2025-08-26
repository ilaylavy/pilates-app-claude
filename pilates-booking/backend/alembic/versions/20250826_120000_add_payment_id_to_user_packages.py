"""add payment_id foreign key to user_packages

Revision ID: 20250826_120000
Revises: 20250824_192600
Create Date: 2025-08-26 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250826_120000'
down_revision = '20250824_192600'
branch_labels = None
depends_on = None


def upgrade():
    """Add payment_id foreign key to user_packages table.
    
    This migration establishes the required dependency between UserPackages and Payment records.
    Every UserPackage must have a corresponding Payment record to ensure data integrity.
    """
    
    # Step 1: Add the payment_id column as nullable first (if it doesn't exist)
    from sqlalchemy import inspect
    from alembic import context
    
    connection = context.get_bind()
    inspector = inspect(connection)
    columns = [col['name'] for col in inspector.get_columns('user_packages')]
    
    if 'payment_id' not in columns:
        op.add_column('user_packages', sa.Column('payment_id', sa.Integer(), nullable=True))
    
    # Step 2: Create Payment records for existing UserPackages that don't have them
    # Since this is a fresh database from reset-db, there should be no existing user_packages
    # But we'll keep this for safety in case this migration is run on an existing database
    
    # First check what enum values exist for paymenttype
    result = connection.execute(sa.text("SELECT enumlabel FROM pg_enum WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'paymenttype')"))
    enum_values = [row[0] for row in result]
    print(f"Available PaymentType enum values: {enum_values}")
    
    # Add the enum value if it doesn't exist 
    if 'package_purchase' not in enum_values:
        op.execute("ALTER TYPE paymenttype ADD VALUE 'package_purchase'")
        print("Added 'package_purchase' to paymenttype enum")
    
    # Check if there are any existing user_packages to migrate
    existing_packages = connection.execute(sa.text("SELECT COUNT(*) FROM user_packages WHERE payment_id IS NULL")).scalar()
    print(f"Found {existing_packages} existing UserPackages without payment_id")
    
    if existing_packages > 0:
        # Only execute the data migration if there are packages to migrate
        op.execute("""
            INSERT INTO payments (user_id, package_id, user_package_id, amount, currency, payment_type, 
                                payment_method, status, payment_date, description, created_at, updated_at)
            SELECT 
                up.user_id,
                up.package_id, 
                up.id,
                p.price,
                'ILS' as currency,
                'package_purchase' as payment_type,
                CASE 
                    WHEN up.payment_method = 'CASH' THEN 'cash'
                    WHEN up.payment_method = 'CREDIT_CARD' THEN 'credit_card'
                    WHEN up.payment_method = 'STRIPE' THEN 'stripe'
                    ELSE 'credit_card'
                END as payment_method,
                CASE 
                    WHEN up.payment_status = 'confirmed' THEN 'completed'
                    WHEN up.payment_status = 'pending' THEN 'pending'
                    WHEN up.payment_status = 'rejected' THEN 'failed'
                    ELSE 'completed'
                END as status,
                COALESCE(up.approved_at, up.purchase_date, up.created_at) as payment_date,
                CONCAT('Migrated payment for package: ', p.name) as description,
                up.created_at,
                up.updated_at
            FROM user_packages up
            JOIN packages p ON up.package_id = p.id
            WHERE NOT EXISTS (
                SELECT 1 FROM payments pay 
                WHERE pay.user_package_id = up.id
            );
        """)
        print(f"Created Payment records for {existing_packages} existing UserPackages")
    else:
        print("No existing UserPackages found - skipping data migration")
    
    # Step 3: Update user_packages.payment_id with the corresponding payment IDs
    op.execute("""
        UPDATE user_packages 
        SET payment_id = (
            SELECT id FROM payments 
            WHERE payments.user_package_id = user_packages.id 
            LIMIT 1
        )
        WHERE payment_id IS NULL;
    """)
    
    # Step 4: Make payment_id NOT NULL now that all records have values
    try:
        op.alter_column('user_packages', 'payment_id', nullable=False)
    except Exception as e:
        print(f"Column already NOT NULL or failed: {e}")
    
    # Step 5: Add foreign key constraint (if it doesn't exist)
    from sqlalchemy.engine import reflection
    inspector = reflection.Inspector.from_engine(connection)
    fk_names = [fk['name'] for fk in inspector.get_foreign_keys('user_packages')]
    
    if 'fk_user_packages_payment_id' not in fk_names:
        op.create_foreign_key(
            'fk_user_packages_payment_id',
            'user_packages', 
            'payments',
            ['payment_id'], 
            ['id'],
            ondelete='RESTRICT'  # Prevent deletion of payments that have user packages
        )
    
    # Step 6: Add index for performance (if it doesn't exist)
    indexes = [idx['name'] for idx in inspector.get_indexes('user_packages')]
    if 'ix_user_packages_payment_id' not in indexes:
        op.create_index('ix_user_packages_payment_id', 'user_packages', ['payment_id'])
    
    # Step 7: Add simple constraint to ensure payment_id is present for active packages
    # Note: Complex payment status validation will be handled at the application level
    constraints = [ck['name'] for ck in inspector.get_check_constraints('user_packages')]
    if 'ck_user_packages_payment_id_required' not in constraints:
        op.create_check_constraint(
            'ck_user_packages_payment_id_required',
            'user_packages',
            'payment_id IS NOT NULL'
        )


def downgrade():
    """Remove payment_id foreign key from user_packages table."""
    
    # Remove constraints and indexes
    op.drop_constraint('ck_user_packages_payment_id_required', 'user_packages')
    op.drop_index('ix_user_packages_payment_id', 'user_packages')
    op.drop_constraint('fk_user_packages_payment_id', 'user_packages')
    
    # Remove the column
    op.drop_column('user_packages', 'payment_id')