"""Merge simplified package model with existing migrations

Revision ID: b1981da4067d
Revises: 20250824_120000, 999fc2ff27fd
Create Date: 2025-08-24 10:27:43.719192

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b1981da4067d'
down_revision = ('20250824_120000', '999fc2ff27fd')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass