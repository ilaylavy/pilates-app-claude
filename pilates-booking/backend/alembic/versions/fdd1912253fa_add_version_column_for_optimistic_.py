"""add_version_column_for_optimistic_locking

Revision ID: fdd1912253fa
Revises: cc344db7976b
Create Date: 2025-08-22 18:19:47.322099

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'fdd1912253fa'
down_revision = 'cc344db7976b'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add version column to class_instances for optimistic locking
    op.add_column('class_instances', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))
    
    # Add version column to bookings for optimistic locking
    op.add_column('bookings', sa.Column('version', sa.Integer(), nullable=False, server_default='1'))


def downgrade() -> None:
    # Remove version columns
    op.drop_column('bookings', 'version')
    op.drop_column('class_instances', 'version')