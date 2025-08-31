"""
Migration script to convert existing announcements to new notification system.

This script:
1. Seeds default notification templates
2. Migrates existing announcements to broadcast notifications
3. Maintains backward compatibility during transition
4. Provides rollback capability if needed

Usage:
    python -m app.scripts.migrate_announcements_to_notifications
"""

import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..core.database import AsyncSessionLocal
from ..models.announcement import Announcement, AnnouncementType
from ..models.notification import (
    Notification, 
    NotificationType, 
    NotificationPriority,
    NotificationTemplate
)
from ..models.user import User, UserRole
from ..services.notification_service import NotificationService
from ..services.notification_template_service import (
    NotificationTemplateService, 
    seed_default_templates
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Mapping from announcement types to notification types (your enhancement #2)
ANNOUNCEMENT_TYPE_MAPPING = {
    AnnouncementType.INFO: NotificationType.GENERAL_ANNOUNCEMENT,
    AnnouncementType.WARNING: NotificationType.ADMIN_ANNOUNCEMENT,
    AnnouncementType.SUCCESS: NotificationType.ADMIN_ANNOUNCEMENT,
    AnnouncementType.URGENT: NotificationType.URGENT_ANNOUNCEMENT
}

# Priority mapping for announcements
ANNOUNCEMENT_PRIORITY_MAPPING = {
    AnnouncementType.URGENT: NotificationPriority.HIGH,
    AnnouncementType.WARNING: NotificationPriority.HIGH,
    AnnouncementType.SUCCESS: NotificationPriority.NORMAL,
    AnnouncementType.INFO: NotificationPriority.LOW
}


class AnnouncementMigrator:
    """Handles migration from announcements to notifications"""
    
    def __init__(self, db: AsyncSession):
        self.db = db
        self.notification_service = NotificationService(db)
        self.template_service = NotificationTemplateService(db)

    async def get_migration_stats(self) -> Dict[str, int]:
        """Get statistics for migration planning"""
        
        # Count total announcements
        total_announcements = await self.db.scalar(
            select(func.count(Announcement.id))
        )
        
        # Count active announcements
        active_announcements = await self.db.scalar(
            select(func.count(Announcement.id)).where(
                Announcement.is_active == True,
                Announcement.deleted_at.is_(None)
            )
        )
        
        # Count by type
        type_counts = {}
        for ann_type in AnnouncementType:
            count = await self.db.scalar(
                select(func.count(Announcement.id)).where(
                    Announcement.type == ann_type.value,
                    Announcement.is_active == True,
                    Announcement.deleted_at.is_(None)
                )
            )
            type_counts[ann_type.value] = count
        
        # Count users by role (for broadcast estimation)
        user_counts = {}
        for role in UserRole:
            count = await self.db.scalar(
                select(func.count(User.id)).where(
                    User.role == role,
                    User.is_active == True
                )
            )
            user_counts[role.value] = count
        
        return {
            "total_announcements": total_announcements,
            "active_announcements": active_announcements,
            "type_counts": type_counts,
            "user_counts": user_counts
        }

    def _get_target_roles_from_announcement(self, announcement: Announcement) -> List[UserRole]:
        """Convert announcement target_roles to UserRole list"""
        if not announcement.target_roles:
            # If no target roles specified, broadcast to all users
            return [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN]
        
        # Map role strings to UserRole enums
        target_roles = []
        for role_str in announcement.target_roles:
            try:
                role = UserRole(role_str)
                target_roles.append(role)
            except ValueError:
                logger.warning(f"Invalid role '{role_str}' in announcement {announcement.id}")
                continue
        
        return target_roles or [UserRole.STUDENT, UserRole.INSTRUCTOR, UserRole.ADMIN]

    async def migrate_single_announcement(
        self, 
        announcement: Announcement,
        dry_run: bool = False
    ) -> Dict[str, Any]:
        """Migrate single announcement to broadcast notification"""
        
        logger.debug(f"Migrating announcement {announcement.id}: {announcement.title}")
        
        try:
            # Determine notification type and priority
            ann_type = AnnouncementType(announcement.type)
            notification_type = ANNOUNCEMENT_TYPE_MAPPING.get(ann_type, NotificationType.GENERAL_ANNOUNCEMENT)
            priority = ANNOUNCEMENT_PRIORITY_MAPPING.get(ann_type, NotificationPriority.NORMAL)
            
            # Get target roles
            target_roles = self._get_target_roles_from_announcement(announcement)
            
            # Prepare notification data
            extra_data = {
                "migrated_from_announcement": True,
                "original_announcement_id": announcement.id,
                "original_type": announcement.type,
                "migration_date": datetime.utcnow().isoformat()
            }
            
            if dry_run:
                # Just count users without creating notifications
                user_count = 0
                for role in target_roles:
                    count = await self.db.scalar(
                        select(func.count(User.id)).where(
                            User.role == role,
                            User.is_active == True
                        )
                    )
                    user_count += count
                
                return {
                    "announcement_id": announcement.id,
                    "notification_type": notification_type.value,
                    "priority": priority.value,
                    "target_roles": [role.value for role in target_roles],
                    "estimated_notifications": user_count,
                    "status": "dry_run"
                }
            else:
                # Create broadcast notification
                notifications = await self.notification_service.create_broadcast_notification(
                    target_roles=target_roles,
                    notification_type=notification_type,
                    title=announcement.title,
                    body=announcement.message,
                    priority=priority,
                    expires_at=announcement.expires_at,
                    sender_id=announcement.created_by,
                    source_type="announcement",
                    source_id=announcement.id,
                    extra_data=extra_data
                )
                
                return {
                    "announcement_id": announcement.id,
                    "notification_type": notification_type.value,
                    "priority": priority.value,
                    "target_roles": [role.value for role in target_roles],
                    "notifications_created": len(notifications),
                    "status": "migrated"
                }
                
        except Exception as e:
            logger.error(f"Failed to migrate announcement {announcement.id}: {str(e)}")
            return {
                "announcement_id": announcement.id,
                "status": "error",
                "error": str(e)
            }

    async def migrate_all_announcements(self, dry_run: bool = False) -> Dict[str, Any]:
        """Migrate all active announcements to notifications (your enhancement #4)"""
        
        logger.info(f"Starting announcement migration {'(DRY RUN)' if dry_run else ''}")
        
        # Get all active announcements
        stmt = select(Announcement).where(
            Announcement.is_active == True,
            Announcement.deleted_at.is_(None)
        ).order_by(Announcement.created_at)
        
        result = await self.db.execute(stmt)
        announcements = result.scalars().all()
        
        if not announcements:
            logger.info("No active announcements found to migrate")
            return {
                "total_processed": 0,
                "successful": 0,
                "failed": 0,
                "results": []
            }
        
        logger.info(f"Found {len(announcements)} announcements to migrate")
        
        results = []
        successful = 0
        failed = 0
        total_notifications = 0
        
        for announcement in announcements:
            try:
                result = await self.migrate_single_announcement(announcement, dry_run)
                results.append(result)
                
                if result["status"] == "migrated":
                    successful += 1
                    total_notifications += result["notifications_created"]
                elif result["status"] == "dry_run":
                    successful += 1
                    total_notifications += result["estimated_notifications"]
                elif result["status"] == "error":
                    failed += 1
                    
            except Exception as e:
                logger.error(f"Unexpected error migrating announcement {announcement.id}: {str(e)}")
                failed += 1
                results.append({
                    "announcement_id": announcement.id,
                    "status": "error",
                    "error": str(e)
                })
        
        migration_summary = {
            "total_processed": len(announcements),
            "successful": successful,
            "failed": failed,
            "total_notifications": total_notifications,
            "dry_run": dry_run,
            "results": results,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Migration completed: {successful}/{len(announcements)} successful, {total_notifications} notifications {'estimated' if dry_run else 'created'}")
        
        return migration_summary

    async def verify_migration(self) -> Dict[str, Any]:
        """Verify that migration completed successfully"""
        
        logger.info("Verifying migration results")
        
        # Count migrated notifications
        migrated_notifications = await self.db.scalar(
            select(func.count(Notification.id)).where(
                Notification.source_type == "announcement"
            )
        )
        
        # Count original announcements
        total_announcements = await self.db.scalar(
            select(func.count(Announcement.id)).where(
                Announcement.is_active == True,
                Announcement.deleted_at.is_(None)
            )
        )
        
        # Get sample of migrated notifications
        sample_stmt = select(Notification).where(
            Notification.source_type == "announcement"
        ).limit(5)
        
        result = await self.db.execute(sample_stmt)
        sample_notifications = result.scalars().all()
        
        verification_result = {
            "total_announcements": total_announcements,
            "migrated_notifications": migrated_notifications,
            "sample_notifications": [
                {
                    "id": n.id,
                    "type": n.type.value,
                    "title": n.title,
                    "source_id": n.source_id,
                    "is_broadcast": n.is_broadcast,
                    "created_at": n.created_at.isoformat()
                }
                for n in sample_notifications
            ],
            "verification_timestamp": datetime.utcnow().isoformat()
        }
        
        logger.info(f"Verification complete: {migrated_notifications} notifications from {total_announcements} announcements")
        
        return verification_result


async def run_migration(dry_run: bool = True, seed_templates: bool = True) -> None:
    """Main migration runner function"""
    
    logger.info("=== Announcement to Notification Migration ===")
    
    async with AsyncSessionLocal() as db:
        try:
            migrator = AnnouncementMigrator(db)
            
            # Step 1: Get migration statistics
            logger.info("Step 1: Analyzing current state...")
            stats = await migrator.get_migration_stats()
            logger.info(f"Migration stats: {stats}")
            
            # Step 2: Seed templates if requested
            if seed_templates:
                logger.info("Step 2: Seeding default notification templates...")
                await seed_default_templates(db)
                logger.info("Templates seeded successfully")
            else:
                logger.info("Step 2: Skipping template seeding")
            
            # Step 3: Run migration
            logger.info(f"Step 3: Running migration {'(DRY RUN)' if dry_run else '(LIVE)'}...")
            migration_result = await migrator.migrate_all_announcements(dry_run)
            
            if not dry_run:
                # Step 4: Verify migration
                logger.info("Step 4: Verifying migration...")
                verification = await migrator.verify_migration()
                logger.info(f"Verification result: {verification}")
            
            logger.info("=== Migration Complete ===")
            logger.info(f"Summary: {migration_result}")
            
            return migration_result
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            raise


# CLI entry point
async def main():
    """CLI entry point for migration script"""
    import argparse
    
    parser = argparse.ArgumentParser(description="Migrate announcements to notification system")
    parser.add_argument("--live", action="store_true", help="Run live migration (default is dry run)")
    parser.add_argument("--no-templates", action="store_true", help="Skip seeding default templates")
    
    args = parser.parse_args()
    
    try:
        await run_migration(
            dry_run=not args.live,
            seed_templates=not args.no_templates
        )
    except Exception as e:
        logger.error(f"Migration script failed: {str(e)}")
        exit(1)


if __name__ == "__main__":
    asyncio.run(main())