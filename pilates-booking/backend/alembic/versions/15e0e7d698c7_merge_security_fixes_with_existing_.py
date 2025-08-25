"""merge_security_fixes_with_existing_migrations

Revision ID: 15e0e7d698c7
Revises: 20250822_184504, security_fix_001
Create Date: 2025-08-23 13:18:36.385675

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '15e0e7d698c7'
down_revision = ('20250822_184504', 'security_fix_001')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass