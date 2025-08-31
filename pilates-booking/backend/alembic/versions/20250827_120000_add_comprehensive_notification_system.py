"""Add comprehensive notification system

Revision ID: 20250827_120000
Revises: 20250826_120000_add_payment_id_to_user_packages
Create Date: 2025-08-27 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20250827_120000'
down_revision = 'ea3078d54245'
branch_labels = None
depends_on = None


def upgrade():
    # Create notification type enum
    notification_type_enum = postgresql.ENUM(
        'BOOKING_SUCCESS',
        'BOOKING_CANCELLED', 
        'PACKAGE_ACTIVATED',
        'PAYMENT_PROCESSED',
        'PAYMENT_FAILED',
        'CLASS_REMINDER',
        'WAITLIST_PROMOTED',
        'ADMIN_ANNOUNCEMENT',
        'URGENT_ANNOUNCEMENT',
        'GENERAL_ANNOUNCEMENT',
        'SYSTEM_MAINTENANCE',
        'ACCOUNT_VERIFIED',
        'PASSWORD_RESET',
        name='notificationtype',
        create_type=False
    )
    notification_type_enum.create(op.get_bind(), checkfirst=True)

    # Create notification priority enum
    notification_priority_enum = postgresql.ENUM(
        'CRITICAL',
        'HIGH',
        'NORMAL', 
        'LOW',
        name='notificationpriority',
        create_type=False
    )
    notification_priority_enum.create(op.get_bind(), checkfirst=True)

    # Create notifications table
    op.create_table(
        'notifications',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('type', notification_type_enum, nullable=False),
        sa.Column('title', sa.String(length=200), nullable=False),
        sa.Column('body', sa.Text(), nullable=False),
        sa.Column('data_json', sa.JSON(), nullable=True),
        sa.Column('priority', notification_priority_enum, nullable=False, server_default='NORMAL'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('archived_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('deleted_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('source_type', sa.String(length=50), nullable=True),
        sa.Column('source_id', sa.Integer(), nullable=True),
        sa.Column('extra_data', sa.JSON(), nullable=True),
        sa.Column('sender_id', sa.Integer(), nullable=True),
        sa.Column('is_broadcast', sa.Boolean(), nullable=False, server_default=sa.text('false')),
        sa.ForeignKeyConstraint(['sender_id'], ['users.id'], ),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for notifications
    op.create_index('idx_notifications_user_id', 'notifications', ['user_id'])
    op.create_index('idx_notifications_created_at', 'notifications', ['created_at'])
    op.create_index('idx_notifications_expires_at', 'notifications', ['expires_at'])
    op.create_index('idx_notifications_source', 'notifications', ['source_type', 'source_id'])
    op.create_index('idx_notifications_type_priority', 'notifications', ['type', 'priority'])
    op.create_index(op.f('ix_notifications_id'), 'notifications', ['id'])

    # Create notification_reads table
    op.create_table(
        'notification_reads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('notification_id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('read_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('dismissed_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['notification_id'], ['notifications.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('notification_id', 'user_id', name='uq_notification_read_user')
    )
    
    # Create indexes for notification_reads
    op.create_index('idx_notification_reads_user', 'notification_reads', ['user_id'])
    op.create_index('idx_notification_reads_notification', 'notification_reads', ['notification_id'])
    op.create_index(op.f('ix_notification_reads_id'), 'notification_reads', ['id'])

    # Create notification_preferences table
    op.create_table(
        'notification_preferences',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.Integer(), nullable=False),
        sa.Column('notification_type', notification_type_enum, nullable=False),
        sa.Column('channel_email', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('channel_push', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('channel_in_app', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.text('true')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('user_id', 'notification_type', name='uq_user_notification_type')
    )
    
    # Create indexes for notification_preferences
    op.create_index('idx_notification_preferences_user', 'notification_preferences', ['user_id'])
    op.create_index(op.f('ix_notification_preferences_id'), 'notification_preferences', ['id'])

    # Create notification_templates table
    op.create_table(
        'notification_templates',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('type', notification_type_enum, nullable=False),
        sa.Column('title_en', sa.String(length=200), nullable=False),
        sa.Column('title_he', sa.String(length=200), nullable=False),
        sa.Column('body_en', sa.Text(), nullable=False),
        sa.Column('body_he', sa.Text(), nullable=False),
        sa.Column('variables', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('type')
    )
    
    # Create indexes for notification_templates
    op.create_index('idx_notification_templates_type', 'notification_templates', ['type'])
    op.create_index(op.f('ix_notification_templates_id'), 'notification_templates', ['id'])


def downgrade():
    # Drop tables in reverse order
    op.drop_index(op.f('ix_notification_templates_id'), table_name='notification_templates')
    op.drop_index('idx_notification_templates_type', table_name='notification_templates')
    op.drop_table('notification_templates')
    
    op.drop_index(op.f('ix_notification_preferences_id'), table_name='notification_preferences')
    op.drop_index('idx_notification_preferences_user', table_name='notification_preferences')
    op.drop_table('notification_preferences')
    
    op.drop_index(op.f('ix_notification_reads_id'), table_name='notification_reads')
    op.drop_index('idx_notification_reads_notification', table_name='notification_reads')
    op.drop_index('idx_notification_reads_user', table_name='notification_reads')
    op.drop_table('notification_reads')
    
    op.drop_index(op.f('ix_notifications_id'), table_name='notifications')
    op.drop_index('idx_notifications_type_priority', table_name='notifications')
    op.drop_index('idx_notifications_source', table_name='notifications')
    op.drop_index('idx_notifications_expires_at', table_name='notifications')
    op.drop_index('idx_notifications_created_at', table_name='notifications')
    op.drop_index('idx_notifications_user_id', table_name='notifications')
    op.drop_table('notifications')
    
    # Drop enums
    notification_priority_enum = postgresql.ENUM(name='notificationpriority')
    notification_priority_enum.drop(op.get_bind(), checkfirst=True)
    
    notification_type_enum = postgresql.ENUM(name='notificationtype')
    notification_type_enum.drop(op.get_bind(), checkfirst=True)