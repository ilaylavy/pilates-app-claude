"""add_announcements_table

Revision ID: 20250824_192600
Revises: b1981da4067d
Create Date: 2025-08-24 19:26:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250824_192600'
down_revision = 'b1981da4067d'
branch_labels = None
depends_on = None


def upgrade():
    # Create announcements table
    op.create_table(
        'announcements',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('type', sa.String(20), nullable=False, server_default='info'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('is_dismissible', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('target_roles', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.Integer(), nullable=False),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # Create indexes
    op.create_index(op.f('ix_announcements_id'), 'announcements', ['id'])
    op.create_index(op.f('ix_announcements_is_active'), 'announcements', ['is_active'])
    op.create_index(op.f('ix_announcements_created_at'), 'announcements', ['created_at'])
    op.create_index(op.f('ix_announcements_expires_at'), 'announcements', ['expires_at'])


def downgrade():
    # Drop indexes
    op.drop_index(op.f('ix_announcements_expires_at'), table_name='announcements')
    op.drop_index(op.f('ix_announcements_created_at'), table_name='announcements')
    op.drop_index(op.f('ix_announcements_is_active'), table_name='announcements')
    op.drop_index(op.f('ix_announcements_id'), table_name='announcements')
    
    # Drop table
    op.drop_table('announcements')