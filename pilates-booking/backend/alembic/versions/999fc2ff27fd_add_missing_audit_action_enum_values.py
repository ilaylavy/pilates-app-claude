"""Add missing audit action enum values

Revision ID: 999fc2ff27fd
Revises: 20250824_105500
Create Date: 2025-08-24 08:21:10.470802

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '999fc2ff27fd'
down_revision = '20250824_105500'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add missing enum values to auditactiontype enum
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'AUTHORIZE_PACKAGE_PAYMENT'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'CONFIRM_PACKAGE_PAYMENT'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE IF NOT EXISTS 'REVOKE_PACKAGE_AUTHORIZATION'")


def downgrade() -> None:
    # Note: PostgreSQL does not support removing enum values directly
    # This would require recreating the enum which is complex
    pass