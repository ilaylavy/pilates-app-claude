"""add_missing_audit_enum_values_properly

Revision ID: 4b46c43f29d8
Revises: 3c928ce023c5
Create Date: 2025-08-21 21:49:47.993088

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '4b46c43f29d8'
down_revision = '3c928ce023c5'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing enum values to auditactiontype
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'UPDATE_USER'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'DEACTIVATE_USER'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'UPDATE_PACKAGE'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'CREATE_PACKAGE'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'DELETE_PACKAGE'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'DATA_ACCESS'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'BOOKING_CREATE'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'BOOKING_CANCEL'")


def downgrade() -> None:
    pass