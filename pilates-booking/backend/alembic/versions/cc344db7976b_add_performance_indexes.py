"""add_performance_indexes

Revision ID: cc344db7976b
Revises: 4b46c43f29d8
Create Date: 2025-08-22 18:17:34.584814

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'cc344db7976b'
down_revision = '4b46c43f29d8'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add composite index for bookings table (user_id, status) for user booking queries
    op.create_index('ix_bookings_user_status', 'bookings', ['user_id', 'status'])
    
    # Add composite index for bookings table (class_instance_id, status) for class booking queries
    op.create_index('ix_bookings_class_status', 'bookings', ['class_instance_id', 'status'])
    
    # Add composite index for class_instances table (start_datetime, status) for scheduling queries
    op.create_index('ix_class_instances_datetime_status', 'class_instances', ['start_datetime', 'status'])
    
    # Add composite index for user_packages table (user_id, is_active) for active package queries
    op.create_index('ix_user_packages_user_active', 'user_packages', ['user_id', 'is_active'])
    
    # Add composite index for user_packages table (user_id, status, expiry_date) for package validation
    op.create_index('ix_user_packages_user_status_expiry', 'user_packages', ['user_id', 'status', 'expiry_date'])
    
    # Add index for booking_date for time-based queries
    op.create_index('ix_bookings_booking_date', 'bookings', ['booking_date'])
    
    # Add index for class_instances end_datetime for cleanup queries
    op.create_index('ix_class_instances_end_datetime', 'class_instances', ['end_datetime'])


def downgrade() -> None:
    # Remove indexes in reverse order
    op.drop_index('ix_class_instances_end_datetime', 'class_instances')
    op.drop_index('ix_bookings_booking_date', 'bookings')
    op.drop_index('ix_user_packages_user_status_expiry', 'user_packages')
    op.drop_index('ix_user_packages_user_active', 'user_packages')
    op.drop_index('ix_class_instances_datetime_status', 'class_instances')
    op.drop_index('ix_bookings_class_status', 'bookings')
    op.drop_index('ix_bookings_user_status', 'bookings')