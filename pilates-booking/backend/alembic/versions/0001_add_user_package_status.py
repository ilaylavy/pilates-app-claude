"""Add status and reservation_expires_at to user_packages

Revision ID: 0001_add_user_package_status
Revises: f05ae53e1709
Create Date: 2025-08-21 00:00:00.000000

"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = "0001_add_user_package_status"
down_revision = "f05ae53e1709"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add status enum type
    op.execute("CREATE TYPE userpackagestatus AS ENUM ('active', 'reserved', 'expired', 'cancelled')")
    
    # Add status column with default value
    op.add_column('user_packages', sa.Column('status', sa.Enum('active', 'reserved', 'expired', 'cancelled', name='userpackagestatus'), nullable=False, server_default='active'))
    
    # Add reservation_expires_at column
    op.add_column('user_packages', sa.Column('reservation_expires_at', sa.DateTime(timezone=True), nullable=True))


def downgrade() -> None:
    # Remove columns
    op.drop_column('user_packages', 'reservation_expires_at')
    op.drop_column('user_packages', 'status')
    
    # Drop enum type
    op.execute("DROP TYPE userpackagestatus")