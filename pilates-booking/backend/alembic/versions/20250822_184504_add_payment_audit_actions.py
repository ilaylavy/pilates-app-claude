"""add payment audit actions

Revision ID: 20250822_184504
Revises: 3d19930024a9
Create Date: 2025-08-22 18:45:04.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20250822_184504'
down_revision = '3d19930024a9'
branch_labels = None
depends_on = None


def upgrade():
    # Add new enum values to auditactiontype
    op.execute("ALTER TYPE auditactiontype ADD VALUE 'APPROVE_PACKAGE_PAYMENT'")
    op.execute("ALTER TYPE auditactiontype ADD VALUE 'REJECT_PACKAGE_PAYMENT'")


def downgrade():
    # Note: PostgreSQL doesn't support removing enum values
    # This would require recreating the enum and updating all references
    pass
