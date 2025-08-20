"""add stripe_customer_id to users

Revision ID: c9f8d1234567
Revises: a6d6127beea2
Create Date: 2025-08-20 10:00:00.000000

"""
from typing import Sequence, Union
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'c9f8d1234567'
down_revision: Union[str, None] = 'a6d6127beea2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add stripe_customer_id column to users table
    op.add_column('users', sa.Column('stripe_customer_id', sa.String(), nullable=True))


def downgrade() -> None:
    # Remove stripe_customer_id column from users table
    op.drop_column('users', 'stripe_customer_id')