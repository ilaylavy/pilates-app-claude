"""merge payment dependency with existing migrations

Revision ID: ea3078d54245
Revises: 4da484fa2bac, 20250826_120000
Create Date: 2025-08-26 20:16:45.582788

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ea3078d54245'
down_revision = ('4da484fa2bac', '20250826_120000')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass